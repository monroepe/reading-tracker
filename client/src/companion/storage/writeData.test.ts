/// <reference types="node" />
// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { migrate, type SqlDatabase } from './database';
import { createBootstrap } from './snapshot';
import { createSqliteWriteData } from './writeData';
import { createSqliteReadData } from './readData';
import { selectionIdentity } from './selectionIdentity';
import { fixture, uuid } from './fixtures.test-helper';
let engine: DatabaseSync, db: SqlDatabase;
let directory: string;
let writes: ReturnType<typeof createSqliteWriteData>;
const refresh = vi.fn(async () => {});
beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'companion-writes-'));
    engine = new DatabaseSync(join(directory, 'library.db'));
    db = { execute: async sql => { engine.exec(sql); }, run: async (sql, values = []) => { engine.prepare(sql).run(...values as SQLInputValue[]); }, query: async <T,>(sql: string, values: unknown[] = []) => engine.prepare(sql).all(...values as SQLInputValue[]) as T[] };
    await migrate(db, uuid(4)); await createBootstrap(db)(fixture(), 'hash');
    refresh.mockClear(); writes = createSqliteWriteData(db, refresh);
});
afterEach(() => { engine.close(); rmSync(directory, { recursive: true }); });
const author = { firstName: 'Ann', middleName: '', lastName: 'Writer', country: null, gender: null };
it('adds an author, book, and reading with UUID references and retained revisions', async () => {
    const a = await writes.createAuthor(author);
    const b = await writes.createBook({ title: 'New book', authorId: a.id, genre: { id: 1 }, category: 'Fiction', pageCount: 100, coAuthors: null, tags: [{ name: 'New tag' }] });
    const r = await writes.createReading({ bookId: b.id, startedOn: '2026-11-02', format: 'Print' });
    await writes.updateReading(r.id, b.id, { finishedOn: '2026-11-03', rating: 9, review: 'Great' }, [{ name: 'favorite' }]);
    const data = await createSqliteReadData(db);
    expect(b.tags.map(t => t.name)).toEqual(['New tag']);
    expect((await data.books.detail(b.id)).tags.map(t => t.name)).toEqual(['Favorite']);
    expect((await data.readings.detail!(r.id)).rating).toBe(9);
    expect(await db.query('SELECT * FROM local_changes')).toHaveLength(7);
    expect(await db.query('SELECT * FROM baselines')).toHaveLength(fixture().records.length);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
});
it('rolls back tags, reading, and history together on failure', async () => {
    await db.execute("CREATE TRIGGER fail_history BEFORE INSERT ON local_changes WHEN json_extract(NEW.record, '$.entityType') = 'bookTags' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
    await expect(writes.updateReading(2, 1, { finishedOn: '2026-11-02' }, [{ name: 'New' }])).rejects.toThrow('synthetic failure');
    expect((await (await createSqliteReadData(db)).readings.detail!(2)).finishedOn).toBeNull();
    expect(await db.query('SELECT * FROM local_changes')).toHaveLength(0);
    expect(await db.query('SELECT * FROM tags')).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
});
it('rejects duplicates, invalid merged dates, and changes to uncertain dates', async () => {
    await writes.createAuthor(author);
    await expect(writes.createAuthor({ ...author, firstName: 'ann' })).rejects.toThrow('already exists');
    await expect(writes.updateReading(2, 1, { finishedOn: '2026-01-01' }, [])).rejects.toThrow();
    await expect(writes.updateReading(3, 2, { startedOn: '2020-02-01' }, [])).rejects.toThrow('uncertain');
    await writes.updateReading(3, 2, { rating: 8 }, []);
    const r = await (await createSqliteReadData(db)).readings.detail!(3);
    expect(r.dateUncertain).toBe(true); expect(r.startedOn).toBe('2020-01-01');
});
it('retains successive edits, skips no-op saves, and serializes concurrent writes', async () => {
    await Promise.all([writes.updateReading(2, 1, { review: 'one' }, [{ id: 1, name: 'Favorite' }]), writes.updateReading(2, 1, { review: 'two' }, [{ id: 1, name: 'Favorite' }])]);
    const before = await db.query('SELECT * FROM local_changes');
    await writes.updateReading(2, 1, { review: 'two' }, [{ id: 1, name: 'Favorite' }]);
    expect(await db.query('SELECT * FROM local_changes')).toEqual(before);
    expect(before).toHaveLength(2);
});
it('derives selection identities identically to PostgreSQL', () => {
    const hex = createHash('md5').update(`${uuid(3)}:${uuid(40)}`).digest('hex');
    expect(selectionIdentity(uuid(3), uuid(40)).replaceAll('-', '')).toBe(hex);
});
it('preserves an old initialized phone database and explains the reinstall requirement', async () => {
    await db.execute('PRAGMA user_version = 2;');
    const before = await db.query('SELECT * FROM baselines');
    await expect(migrate(db, uuid(999))).rejects.toThrow('uninstall and reinstall');
    expect(await db.query('SELECT * FROM baselines')).toEqual(before);
    expect(await db.query('PRAGMA user_version')).toEqual([{ user_version: 2 }]);
});

it('preserves phone-entered data and history after reopening and migrating again', async () => {
    const created = await writes.createAuthor(author);
    const history = await db.query('SELECT * FROM local_changes');
    engine.close(); engine = new DatabaseSync(join(directory, 'library.db'));
    await migrate(db, uuid(999));
    expect((await (await createSqliteReadData(db)).authors.detail(created.id)).lastName).toBe('Writer');
    expect(await db.query('SELECT * FROM local_changes')).toEqual(history);
});
it('allows retry after a rolled-back transaction and creates no orphaned tags', async () => {
    await expect(writes.createBook({ title: '', authorId: 1, genre: { id: 1 }, coAuthors: null, category: 'Fiction', pageCount: 100, tags: [{ name: 'Unused' }] })).rejects.toThrow();
    expect(await db.query('SELECT * FROM tags')).toHaveLength(1);
    const created = await writes.createAuthor(author);
    expect(created.lastName).toBe('Writer');
});
it('edits imported catalog records without changing identities or reading links', async () => {
    const before = await db.query('SELECT id, uuid FROM books');
    const a = await writes.createAuthor(author);
    const canada = await writes.createCatalog!('countries', 'Canada');
    await writes.updateAuthor(a.id, { ...author, countryIds: [canada.id] });
    const input = { title: 'Corrected', authorId: a.id, genre: { id: 1 }, category: 'Fiction' as const, pageCount: 123, coAuthors: null, tags: [{ name: 'New tag' }] };
    await writes.updateBook(1, input);
    const reads = await createSqliteReadData(db);
    expect((await reads.authors.detail(a.id)).country).toBe('Canada');
    expect((await reads.readings.detail!(2)).book.title).toBe('Corrected');
    expect(await db.query('SELECT id, uuid FROM books')).toEqual(before);
    const changes = await db.query('SELECT * FROM local_changes');
    await writes.updateBook(1, input);
    expect(await db.query('SELECT * FROM local_changes')).toEqual(changes);
});
it('rolls back catalog edits when tag history fails', async () => {
    const before = await db.query('SELECT * FROM books');
    await db.execute("CREATE TRIGGER fail_catalog BEFORE INSERT ON local_changes WHEN json_extract(NEW.record, '$.entityType') = 'bookTags' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
    await expect(writes.updateBook(1, { title: 'Changed', authorId: 1, genre: { id: 1 }, category: 'Fiction', pageCount: 50, coAuthors: null, tags: [{ name: 'New' }] })).rejects.toThrow();
    expect(await db.query('SELECT * FROM books')).toEqual(before);
    expect(await db.query('SELECT * FROM local_changes')).toHaveLength(0);
});

it('constructs save results without full-library hydration and refreshes once after commit', async () => {
    const query = vi.spyOn(db, 'query');
    let refreshes = 0;
    const repository = createSqliteWriteData(db, async () => {
        refreshes++;
        // No hydration SELECTs happened inside the transaction.
        expect(query.mock.calls.some(([sql]) => sql === 'SELECT id, data FROM authors')).toBe(false);
    });
    const created = await repository.createAuthor(author);
    expect(created).toEqual(await (await createSqliteReadData(db)).authors.detail(created.id));
    expect(refreshes).toBe(1);
});

it('returns the latest finished reading even when the edited book falls outside the first list page', async () => {
    const a = await writes.createAuthor(author);
    for (let i = 0; i < 26; i++) await writes.createBook({ title: `A book ${i}`, authorId: a.id, genre: { id: 1 }, category: 'Fiction', pageCount: 100, coAuthors: null, tags: [] });
    const input = { title: 'Z book', authorId: a.id, genre: { id: 1 }, category: 'Fiction' as const, pageCount: 100, coAuthors: null, tags: [] };
    const book = await writes.createBook(input);
    const reading = await writes.createReading({ bookId: book.id, startedOn: '2026-11-01', format: 'Print' });
    await writes.updateReading(reading.id, book.id, { finishedOn: '2026-11-02', rating: 8 }, []);
    const updated = await writes.updateBook(book.id, { ...input, pageCount: 200 });
    expect(updated.lastReading?.id).toBe(reading.id);
    expect(updated).toEqual((await (await createSqliteReadData(db)).books.list({ pageSize: 1000 })).data.find(b => b.id === book.id));
});

it('rolls back a write if focused result construction fails before commit', async () => {
    const original = db.query;
    db.query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => {
        if (sql === 'SELECT * FROM authors WHERE id = ?') throw new Error('result read failed');
        return original<T>(sql, values);
    };
    await expect(writes.createAuthor(author)).rejects.toThrow('result read failed');
    expect(await original('SELECT * FROM local_changes')).toHaveLength(0);
    expect(refresh).not.toHaveBeenCalled();
});

it('edits tags independently on a book without readings and tracks the complete selection', async () => {
    const book = await writes.createBook({ title: 'Unread', authorId: 1, genre: { id: 1 }, category: 'Fiction', pageCount: 100, coAuthors: null, tags: [] });
    refresh.mockClear();
    await writes.updateBookTags!(book.id, [{ name: 'Independent' }]);
    let reads = await createSqliteReadData(db);
    expect((await reads.books.detail(book.id)).tags.map(t => t.name)).toEqual(['Independent']);
    expect(await reads.books.readings(book.id)).toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(1);
    await writes.updateBookTags!(book.id, []);
    reads = await createSqliteReadData(db);
    expect((await reads.books.detail(book.id)).tags).toEqual([]);
    expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
});
it('rejects direct tag edits while the phone export is pending', async () => {
    await db.run("INSERT INTO metadata(key,value) VALUES ('pendingOutbound', ?)", ['frozen']);
    await expect(writes.updateBookTags!(1, [{ name: 'Blocked' }])).rejects.toThrow('paused');
    expect(await db.query('SELECT * FROM local_changes')).toHaveLength(0);
});

it('creates countries, replaces associations, and renames without revising associated authors', async () => {
    const canada = await writes.createCatalog!('countries',' Canada ');
    const france = await writes.createCatalog!('countries','France');
    await expect(writes.createCatalog!('countries','canada')).rejects.toThrow('Already exists');
    const a = await writes.createAuthor({...author,countryIds:[canada.id,france.id]});
    const before = await db.query("SELECT * FROM current_records WHERE entity_type='authors'");
    await writes.renameCatalog!('countries',canada.id,'Canada renamed');
    expect(await db.query("SELECT * FROM current_records WHERE entity_type='authors'")).toEqual(before);
    const reads = await createSqliteReadData(db);
    expect((await reads.authors.detail(a.id)).countries?.map(c=>c.name)).toEqual(['Canada renamed','France']);
    expect((await reads.authors.list({country:'France'})).data.some(row=>row.id===a.id)).toBe(true);
    await expect(writes.renameCatalog!('countries',canada.id,'France')).rejects.toThrow('Already exists');
    await writes.updateAuthor(a.id,{...author,countryIds:[]});
    expect((await (await createSqliteReadData(db)).authors.detail(a.id)).countries).toEqual([]);
});
it('creates and renames genres without changing book identities', async () => {
    const g = await writes.createCatalog!('genres','New genre');
    const b = await writes.createBook({ title:'Genre test',authorId:1,genre:{id:g.id},coAuthors:null,category:'Fiction',pageCount:100,tags:[] });
    const before = await db.query('SELECT id,uuid FROM books WHERE id=?',[b.id]);
    await writes.renameCatalog!('genres',g.id,'Renamed genre');
    expect((await (await createSqliteReadData(db)).books.detail(b.id)).genre.name).toBe('Renamed genre');
    expect(await db.query('SELECT id,uuid FROM books WHERE id=?',[b.id])).toEqual(before);
});
