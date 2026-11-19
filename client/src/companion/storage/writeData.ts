import { ZodError } from 'zod';
import type { WriteData } from '@/data/writeData';
import { authorInput } from '../../../../server/src/authors/authors.schemas';
import { bookInput } from '../../../../server/src/books/books.schemas';
import { readingInput, readingUpdate } from '../../../../server/src/readings/readings.schemas';
import { snapshotRecord } from '../../../../server/src/transfers/transfer-contract';
import { metadata, transaction, type SqlDatabase } from './database';
import type { Author, Book, BookReading, Reading } from '@/api/types';
import { getToday } from '@/features/readings/utils/readingUtils';
import { selectionIdentity } from './selectionIdentity';
import type { SnapshotRecord } from './snapshot';
type Row = { id: number; uuid: string; data: string };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export function createSqliteWriteData(db: SqlDatabase, committed: () => Promise<void>): WriteData {
    let queue: Promise<unknown> = Promise.resolve();
    async function row(table: string, id: number): Promise<Row> {
        const [value] = await db.query<Row>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
        if (!value) throw new Error('Selected record no longer exists.');
        return value;
    }
    // Build mutation results inside the transaction without hydrating the library.
    async function savedAuthor(id: number): Promise<Author> {
        const value = await row('authors', id);
        const data = JSON.parse(value.data);
        const countries = await db.query<{id:number;data:string}>('SELECT c.id,c.data FROM countries c JOIN author_countries ac ON ac.country_id=c.id WHERE ac.author_id=?', [id]);
        const selected = countries.map(c => ({id:c.id,name:String(JSON.parse(c.data).name)})).sort((a,b)=>a.name.localeCompare(b.name));
        return { id, ...data, countries: selected, country: selected.map(c=>c.name).join(', ') || null };
    }
    async function savedBook(id: number, includeLastReading = true): Promise<Book> {
        const value = await row('books', id) as Row & { author_id: number; genre_id: number };
        const { authorId: _author, genreId: _genre, ...data } = JSON.parse(value.data);
        void _author; void _genre;
        const author = await savedAuthor(value.author_id);
        const genre = await row('genres', value.genre_id);
        let lastReading: BookReading | null = null;
        if (includeLastReading) {
            const [latest] = await db.query<Row>(`SELECT id, data FROM readings WHERE book_id = ?
                AND json_extract(data, '$.finishedOn') IS NOT NULL
                ORDER BY json_extract(data, '$.finishedOn') DESC, id DESC LIMIT 1`, [id]);
            if (latest) {
                const { bookId: _book, ...reading } = JSON.parse(latest.data);
                void _book;
                lastReading = { id: latest.id, ...reading };
            }
        }
        const tags = await db.query<{ id: number; data: string }>(`SELECT t.id, t.data FROM tags t
            JOIN book_tags bt ON bt.tag_id = t.id JOIN book_tag_sets s ON s.id = bt.selection_id
            WHERE s.book_id = ?`, [id]);
        return { id, ...data, tags: tags.map(t => ({ id: t.id, name: String(JSON.parse(t.data).name) })).sort((a, b) => a.name.localeCompare(b.name)), author, genre: { id: genre.id, ...JSON.parse(genre.data) }, lastReading };
    }
    async function savedReading(id: number): Promise<Reading> {
        const value = await row('readings', id) as Row & { book_id: number };
        const { bookId: _bookId, ...data } = JSON.parse(value.data);
        void _bookId;
        const { author, genre, lastReading: _last, tags: _tags, ...book } = await savedBook(value.book_id, false);
        void _last; void _tags;
        return { id, ...data, book, author, genre,
            days: data.abandoned || data.dateUncertain ? null : Math.round((Date.parse(data.finishedOn ?? getToday()) - Date.parse(data.startedOn)) / 86400000) };
    }
    async function track(type: SnapshotRecord['entityType'], uuid: string, data: unknown) {
        const [previous] = await db.query<{ record: string }>('SELECT record FROM current_records WHERE entity_type = ? AND uuid = ?', [type, uuid]);
        const baseline = previous ? JSON.parse(previous.record) as SnapshotRecord : null;
        const normalized = (value: unknown) => {
            if (type === 'bookTags' && value) {
                const selection = value as { bookId: string; tagIds: string[] };
                return { bookId: selection.bookId, tagIds: [...selection.tagIds].sort() };
            }
            return value;
        };
        if (baseline && JSON.stringify(normalized(baseline.data)) === JSON.stringify(normalized(data))) return;
        const record = snapshotRecord.parse({ entityType: type, entityId: uuid, revision: crypto.randomUUID(), data });
        const info = await metadata(db);
        await db.run('INSERT INTO local_changes(change_id, device_id, baseline, record) VALUES (?, ?, ?, ?)', [crypto.randomUUID(), info.deviceId, baseline ? JSON.stringify(baseline) : null, JSON.stringify(record)]);
        await db.run('INSERT OR REPLACE INTO current_records VALUES (?, ?, ?)', [type, uuid, JSON.stringify(record)]);
    }
    async function insert(table: 'authors' | 'tags' | 'countries' | 'genres', data: unknown) {
        const uuid = crypto.randomUUID();
        await db.run(`INSERT INTO ${table}(uuid, data) VALUES (?, ?)`, [uuid, JSON.stringify(data)]);
        await track(table, uuid, data);
        return (await db.query<Row>(`SELECT * FROM ${table} WHERE uuid = ?`, [uuid]))[0];
    }
    async function tagsFor(book: Row, choices: ({ id: number } | { name: string })[]) {
        const tags: Row[] = [];
        for (const choice of choices) {
            let tag: Row;
            if ('id' in choice) tag = await row('tags', choice.id);
            else {
                const name = choice.name.trim();
                if (!name) throw new Error('Tag name is required.');
                tag = (await db.query<Row>('SELECT * FROM tags')).find(t => same(JSON.parse(t.data).name, name)) ?? await insert('tags', { name, ownedByLibrary: true });
            }
            if (!tags.some(t => t.id === tag.id)) tags.push(tag);
        }
        const [existing] = await db.query<{ id: number; uuid: string }>('SELECT id, uuid FROM book_tag_sets WHERE book_id = ?', [book.id]);
        const uuid = existing?.uuid ?? selectionIdentity((await metadata(db)).libraryId, book.uuid);
        if (!existing) await db.run('INSERT INTO book_tag_sets(uuid, book_id) VALUES (?, ?)', [uuid, book.id]);
        const [selection] = await db.query<{ id: number }>('SELECT id FROM book_tag_sets WHERE uuid = ?', [uuid]);
        await db.run('DELETE FROM book_tags WHERE selection_id = ?', [selection.id]);
        for (const tag of tags) await db.run('INSERT INTO book_tags VALUES (?, ?)', [selection.id, tag.id]);
        await track('bookTags', uuid, { bookId: book.uuid, tagIds: tags.map(t => t.uuid).sort() });
    }
    function save<T>(work: () => Promise<T>): Promise<T> {
        const result = queue.then(async () => {
            const value = await transaction(db, async () => {
                if ((await metadata(db)).pendingOutbound) throw new Error('Phone editing is paused. Import the laptop refresh to continue.');
                if (!(await metadata(db)).transferId) throw new Error('Import a laptop snapshot first.');
                return work();
            });
            // The save is committed. A projection failure must not invite repeating it.
            await committed();
            return value;
        });
        queue = result.catch(() => undefined);
        return result.catch(error => {
            if (error instanceof ZodError) throw new Error(error.issues.map(issue => issue.message).join(' '));
            throw error;
        });
    }
    async function countryRefs(ids: number[] = []) {
        const values = [];
        for (const id of [...new Set(ids)]) values.push(await row('countries', id));
        return values;
    }
    async function setCountries(id: number, values: Row[]) {
        await db.run('DELETE FROM author_countries WHERE author_id=?', [id]);
        for (const country of values) await db.run('INSERT INTO author_countries VALUES (?,?)', [id,country.id]);
    }
    return {
        createCatalog: (kind, name) => save(async () => {
            name = name.trim();
            if (!name) throw new Error('Name is required.');
            if ((await db.query<Row>(`SELECT * FROM ${kind}`)).some(c => same(JSON.parse(c.data).name,name))) throw new Error('Already exists');
            const created = await insert(kind,{name});
            return {id:created.id,name};
        }),
        renameCatalog: (kind, id, name) => save(async () => {
            name = name.trim();
            if (!name) throw new Error('Name is required.');
            const existing = await row(kind,id);
            if ((await db.query<Row>(`SELECT * FROM ${kind}`)).some(c => c.id!==id && same(JSON.parse(c.data).name,name))) throw new Error('Already exists');
            await db.run(`UPDATE ${kind} SET data=? WHERE id=?`, [JSON.stringify({name}),id]);
            await track(kind,existing.uuid,{name});
        }),
        updateBookTags: (id, tags) => save(async () => {
            await tagsFor(await row('books', id), tags);
        }),
        updateAuthor: (id, input) => save(async () => {
            const existing = await row('authors', id);
            const parsed = authorInput.parse(input);
            const selectedCountries = await countryRefs(parsed.countryIds ?? (await db.query<{country_id:number}>('SELECT country_id FROM author_countries WHERE author_id=?',[id])).map(c=>c.country_id));
            const data = { firstName: parsed.firstName ?? '', middleName: parsed.middleName ?? '', lastName: parsed.lastName, countryIds: selectedCountries.map(c => c.uuid).sort(), gender: parsed.gender ?? null };
            if ((await db.query<Row>('SELECT * FROM authors')).some(a => a.id !== id && ['firstName', 'middleName', 'lastName'].every(k => same(JSON.parse(a.data)[k], data[k as 'firstName' | 'middleName' | 'lastName'] ?? '')))) throw new Error('An author with that name already exists.');
            await db.run('UPDATE authors SET data = ? WHERE id = ?', [JSON.stringify(data), id]);
            await setCountries(id, selectedCountries);
            await track('authors', existing.uuid, data);
            return savedAuthor(id);
        }),
        updateBook: (id, input) => save(async () => {
            const existing = await row('books', id);
            if (!('id' in input.genre)) throw new Error('Select an existing genre.');
            const parsed = bookInput.parse({ ...input, genreId: input.genre.id });
            const author = await row('authors', parsed.authorId), genre = await row('genres', parsed.genreId);
            if ((await db.query<Row>('SELECT * FROM books')).some(b => b.id !== id && same(JSON.parse(b.data).title, parsed.title) && JSON.parse(b.data).authorId === author.uuid)) throw new Error('A book with that title and author already exists.');
            const data = { title: parsed.title, authorId: author.uuid, genreId: genre.uuid, coAuthors: parsed.coAuthors ?? null, category: parsed.category, pageCount: parsed.pageCount };
            await db.run('UPDATE books SET data = ?, author_id = ?, genre_id = ? WHERE id = ?', [JSON.stringify(data), author.id, genre.id, id]);
            await track('books', existing.uuid, data);
            await tagsFor(existing, input.tags);
            return savedBook(id);
        }),
        createAuthor: input => save(async () => {
            const parsed = authorInput.parse(input);
            const selectedCountries = await countryRefs(parsed.countryIds);
            const data = { firstName: parsed.firstName ?? '', middleName: parsed.middleName ?? '', lastName: parsed.lastName, countryIds: selectedCountries.map(c => c.uuid).sort(), gender: parsed.gender ?? null };
            if ((await db.query<Row>('SELECT * FROM authors')).some(a => { const d = JSON.parse(a.data); return ['firstName', 'middleName', 'lastName'].every(k => same(d[k], data[k as 'firstName' | 'middleName' | 'lastName'] ?? '')); })) throw new Error('An author with that name already exists.');
            const created = await insert('authors', data);
            await setCountries(created.id, selectedCountries);
            return savedAuthor(created.id);
        }),
        createBook: input => save(async () => {
            if (!('id' in input.genre)) throw new Error('Select an existing genre.');
            const parsed = bookInput.parse({ ...input, genreId: input.genre.id });
            const author = await row('authors', parsed.authorId), genre = await row('genres', parsed.genreId);
            if ((await db.query<Row>('SELECT * FROM books')).some(b => { const d = JSON.parse(b.data); return same(d.title, parsed.title) && d.authorId === author.uuid; })) throw new Error('A book with that title and author already exists.');
            const uuid = crypto.randomUUID();
            const data = { title: parsed.title, authorId: author.uuid, genreId: genre.uuid, coAuthors: parsed.coAuthors ?? null, category: parsed.category, pageCount: parsed.pageCount };
            await db.run('INSERT INTO books(uuid, data, author_id, genre_id) VALUES (?, ?, ?, ?)', [uuid, JSON.stringify(data), author.id, genre.id]);
            const [book] = await db.query<Row>('SELECT * FROM books WHERE uuid = ?', [uuid]);
            await track('books', uuid, data); await tagsFor(book, input.tags);
            return savedBook(book.id, false);
        }),
        createReading: input => save(async () => {
            const parsed = readingInput.parse(input), book = await row('books', parsed.bookId);
            const uuid = crypto.randomUUID();
            const data = { bookId: book.uuid, startedOn: parsed.startedOn, finishedOn: null, dateUncertain: false, abandoned: false, format: parsed.format, rating: null, review: null };
            await db.run('INSERT INTO readings(uuid, data, book_id) VALUES (?, ?, ?)', [uuid, JSON.stringify(data), book.id]);
            const [created] = await db.query<Row>('SELECT * FROM readings WHERE uuid = ?', [uuid]);
            await track('readings', uuid, data);
            return savedReading(created.id);
        }),
        updateReading: (id, bookId, values, tags) => save(async () => {
            const reading = await row('readings', id), book = await row('books', bookId);
            const before = JSON.parse(reading.data);
            const patch = readingUpdate.parse(values);
            if (before.bookId !== book.uuid || (patch.bookId !== undefined && patch.bookId !== bookId)) throw new Error('The reading book cannot be changed.');
            if (before.dateUncertain && ['startedOn', 'finishedOn', 'abandoned'].some(k => k in patch)) throw new Error('Imported uncertain dates cannot be changed.');
            const { bookId: ignored, ...fields } = patch; void ignored;
            const data = { ...before, ...fields };
            // Contract validation also checks the merged dates and abandonment state.
            snapshotRecord.parse({ entityType: 'readings', entityId: reading.uuid, revision: crypto.randomUUID(), data });
            await db.run('UPDATE readings SET data = ? WHERE id = ?', [JSON.stringify(data), id]);
            await track('readings', reading.uuid, data); await tagsFor(book, tags);
            return savedReading(id);
        }),
    };
}
