/// <reference types="node" />
// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, metadata, type SqlDatabase } from './database';
import { createBootstrap, checkBootstrap, readSnapshot, MAX_SNAPSHOT_BYTES } from './snapshot';
import { createSqliteReadData } from './readData';
import { fixture, uuid } from './fixtures.test-helper';
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length)
    cleanup.pop()!(); });
function open(path = ':memory:') {
    const engine = new DatabaseSync(path);
    cleanup.push(() => engine.close());
    const db: SqlDatabase = {
        execute: async (sql) => { engine.exec(sql); },
        run: async (sql, values = []) => { engine.prepare(sql).run(...values as SQLInputValue[]); },
        query: async <T,>(sql: string, values: unknown[] = []) => engine.prepare(sql).all(...values as SQLInputValue[]) as T[],
    };
    return { engine, db };
}
async function initialized() {
    const { db, engine } = open();
    await migrate(db, uuid(4));
    await createBootstrap(db)(fixture(), 'hash');
    return { db, engine, data: await createSqliteReadData(db, '2026-11-02') };
}
describe('SQLite bootstrap and migrations', () => {
    it('persists identities, baseline tombstones, empty selections and foreign-key mappings across reopen', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'reading-companion-'));
        cleanup.push(() => rmSync(dir, { recursive: true }));
        const path = join(dir, 'library.db');
        const { db } = open(path);
        await migrate(db, uuid(4));
        const bootstrap = createBootstrap(db);
        await expect(bootstrap(fixture(), 'hash')).resolves.toBe('imported');
        await expect(bootstrap(fixture(), 'hash')).resolves.toBe('repeat');
        const reopened = open(path).db;
        await migrate(reopened, uuid(5));
        expect((await metadata(reopened)).deviceId).toBe(uuid(4));
        expect(await reopened.query('PRAGMA foreign_key_check')).toEqual([]);
        expect(await reopened.query('SELECT id FROM books')).toHaveLength(2);
        expect(await reopened.query('SELECT id FROM book_tag_sets')).toHaveLength(2);
        expect(await reopened.query('SELECT * FROM baselines WHERE uuid = ?', [uuid(42)])).toHaveLength(1);
        const data = await createSqliteReadData(reopened);
        expect((await data.books.detail(1)).tags.map(t => t.name)).toEqual(['Favorite']);
        expect((await data.books.detail(2)).tags).toEqual([]);
        const changed = fixture();
        changed.transferId = uuid(99);
        await expect(createBootstrap(reopened)(changed, 'other')).rejects.toThrow('already initialized');
        await expect(bootstrap(fixture(), 'changed')).rejects.toThrow('different content');
    });
    it('commits an empty snapshot as initialized', async () => {
        const { db } = open();
        await migrate(db, uuid(4));
        await createBootstrap(db)({ ...fixture(), records: [] }, 'hash');
        expect((await metadata(db)).transferId).toBe(uuid(1));
        expect((await (await createSqliteReadData(db)).books.list({})).total).toBe(0);
    });
    it('rolls back an interrupted write and supports retry', async () => {
        const { db } = open();
        await migrate(db, uuid(4));
        let count = 0;
        const failing = { ...db, run: async (sql: string, values?: unknown[]) => { if (++count === 6)
                throw new Error('interrupted'); await db.run(sql, values); } };
        await expect(createBootstrap(failing)(fixture(), 'hash')).rejects.toThrow('interrupted');
        expect(await db.query('SELECT * FROM baselines')).toEqual([]);
        expect((await metadata(db)).transferId).toBeUndefined();
        await expect(createBootstrap(db)(fixture(), 'hash')).resolves.toBe('imported');
    });
    it('rejects malformed snapshots and wrong destinations without writes', async () => {
        const { db } = open();
        await migrate(db, uuid(4));
        await expect(createBootstrap(db)({ ...fixture(), destinationDeviceId: uuid(999) }, 'hash')).rejects.toThrow('another device');
        const broken = fixture();
        broken.records = broken.records.filter(r => r.entityType !== 'authors');
        await expect(createBootstrap(db)(broken, 'hash')).rejects.toThrow();
        await expect(createBootstrap(db)({ ...fixture(), version: 1 } as never, 'hash')).rejects.toThrow();
        expect(await db.query('SELECT * FROM baselines')).toEqual([]);
        expect(() => checkBootstrap({ deviceId: uuid(4) }, { ...fixture(), sourceDeviceId: uuid(4) }, 'hash')).toThrow('source');
    });
    it('rejects simultaneous imports', async () => {
        const { db } = open();
        await migrate(db, uuid(4));
        const bootstrap = createBootstrap(db);
        const pending = bootstrap(fixture(), 'hash');
        await expect(bootstrap(fixture(), 'hash')).rejects.toThrow('already running');
        await pending;
    });
    it('preserves a database created by a newer app', async () => {
        const { db } = open();
        await db.execute('PRAGMA user_version = 4');
        await expect(migrate(db, uuid(4))).rejects.toThrow('newer app');
        expect(await db.query('PRAGMA user_version')).toEqual([{ user_version: 4 }]);
    });
});
describe('offline queries', () => {
    it('matches title/author search, literal wildcards, tags, sorting and pagination', async () => {
        const { data } = await initialized();
        expect((await data.books.list({ search: 'Ursula Le Guin' })).data.map(b => b.title)).toEqual(['The Dispossessed']);
        expect((await data.books.list({ q: '%' })).total).toBe(0);
        expect((await data.books.list({ tagIds: [1] })).total).toBe(1);
        expect((await data.books.list({ page: 2, pageSize: 1 })).data[0].title).toBe('The Dispossessed');
        expect((await data.books.list({ sort: 'rating', order: 'desc' })).data[0].title).toBe('Kindred');
        expect((await data.tags.list({ q: 'FAV', page: 1, pageSize: 50 })).total).toBe(1);
    });
    it('uses finish year, local current date, pre-2022 and abandonment semantics', async () => {
        const { data } = await initialized();
        const rows = (await data.readings.list({ year: 2026 })).data;
        expect(rows).toHaveLength(2);
        expect(rows[0].finishedOn).toBeNull();
        expect(rows[0].days).toBe(1);
        expect(rows[1].days).toBe(9);
        const old = (await data.readings.list({ year: 'pre-2022' })).data;
        expect(old).toHaveLength(1);
        expect(old[0].days).toBeNull();
        expect((await data.readings.list({ year: 2020 })).total).toBe(0);
        const abandoned = (await data.readings.list({ abandoned: true, year: 1900 })).data;
        expect(abandoned).toHaveLength(1);
        expect(abandoned[0].days).toBeNull();
        expect((await data.readings.list({ sort: 'finishedOn', order: 'asc' })).data.at(-1)?.finishedOn).toBeNull();
    });
    it('distinguishes latest finished book reading from latest-start author history', async () => {
        const { data } = await initialized();
        expect((await data.books.list({ q: 'Dispossessed' })).data[0].lastReading?.rating).toBe(8.5);
        const books = await data.authors.books(1);
        expect(books[0].readingCount).toBe(2);
        expect(books[0].lastReading?.finishedOn).toBeNull();
        expect((await data.books.readings(1))[0].format).toBe('Kindle');
        expect((await data.authors.list({ country: 'usa' })).total).toBe(1);
        expect(await data.authors.countries()).toEqual(['USA']);
        expect((await data.authors.list({ q: 'Ursula Le Guin' })).total).toBe(1);
        await expect(data.books.detail(100)).rejects.toThrow('not found');
    });
});
it('validates file bytes and rejects oversized, malformed and unsupported input', async () => {
    const snapshot = fixture();
    const parsed = await readSnapshot(new File([JSON.stringify(snapshot)], 'snapshot.json'));
    expect(parsed.snapshot).toEqual(snapshot);
    expect(parsed.hash).toMatch(/^[a-f0-9]{64}$/);
    expect((await readSnapshot(new File([JSON.stringify(snapshot)], 'again.json'))).hash).toBe(parsed.hash);
    await expect(readSnapshot({ size: MAX_SNAPSHOT_BYTES + 1 } as File)).rejects.toThrow('10 MiB');
    await expect(readSnapshot(new File(['{'], 'bad.json'))).rejects.toThrow();
    await expect(readSnapshot(new File([JSON.stringify({ ...snapshot, version: 99 })], 'future.json'))).rejects.toThrow();
});

it('preserves grouped history ties and tag associations without mutating groups between queries', async () => {
    const { db } = await initialized();
    const [{ data: encoded }] = await db.query<{ data: string }>('SELECT data FROM readings WHERE id = 1');
    await db.run('INSERT INTO readings(id,uuid,data,book_id) VALUES (5,?,?,1)', [uuid(500), encoded]);
    const data = await createSqliteReadData(db, '2026-11-02');
    expect((await data.books.list({ q: 'Dispossessed' })).data[0].lastReading?.id).toBe(5);
    expect((await data.books.readings(1)).map(r => r.id)).toEqual([2, 5, 1]);
    expect((await data.authors.books(1))[0].lastReading?.id).toBe(2);
    expect((await data.books.readings(1)).map(r => r.id)).toEqual([2, 5, 1]);
    expect((await data.books.detail(1)).tags.map(t => t.name)).toEqual(['Favorite']);
    expect((await data.books.detail(2)).tags).toEqual([]);
});

it('sorts ratings in both directions with unrated items last and uses the latest finished book reading', async () => {
    const { db } = await initialized();
    const [{ data: encoded }] = await db.query<{ data: string }>('SELECT data FROM readings WHERE id = 1');
    const reading = JSON.parse(encoded);
    await db.run('INSERT INTO readings(id,uuid,data,book_id) VALUES (5,?,?,1)', [uuid(500), JSON.stringify({ ...reading, startedOn: '2026-03-01', finishedOn: '2026-03-10', rating: 7 })]);
    const [{ data: book }] = await db.query<{ data: string }>('SELECT data FROM books WHERE id = 1');
    await db.run('INSERT INTO books(id,uuid,data,author_id,genre_id) VALUES (3,?,?,1,1)', [uuid(501), JSON.stringify({ ...JSON.parse(book), title: 'Unrated' })]);
    const data = await createSqliteReadData(db, '2026-11-02');
    for (const order of ['asc', 'desc'] as const) {
        const books = (await data.books.list({ sort: 'rating', order })).data;
        expect(books.map(b => b.id)).toEqual(order === 'asc' ? [1, 2, 3] : [2, 1, 3]);
        expect(books.find(b => b.id === 1)?.lastReading?.rating).toBe(7);
        const readings = (await data.readings.list({ sort: 'rating', order })).data;
        expect(readings.map(r => r.rating)).toEqual(order === 'asc' ? [7, 8.5, 9, null] : [9, 8.5, 7, null]);
    }
});

it('refreshes reading durations without rebuilding the projection', async () => {
    const { db } = open();
    await migrate(db, uuid(4));
    await createBootstrap(db)(fixture(), 'hash');
    let day = '2026-11-02';
    const reads = await createSqliteReadData(db, () => day);
    const before = await reads.readings.detail!(2);
    day = '2026-11-03';
    const after = await reads.readings.detail!(2);
    expect(after.days).toBe(before.days! + 1);
    const list = await reads.readings.list({});
    expect(list.data.find(r => r.id === 2)?.days).toBe(after.days);
});
