import { createLibraryReadData } from '@/data/libraryReadData';
import type { ReadData } from '@/data/readData';
import type { BookDetail } from '@/api/types';
import { getToday } from '@/features/readings/utils/readingUtils';
import type { SnapshotRecord } from './snapshot';
import type { SqlDatabase } from './database';
type Live<T extends SnapshotRecord['entityType']> = NonNullable<Extract<SnapshotRecord, {
    entityType: T;
}>['data']>;
type Row<T> = {
    id: number;
    data: string;
} & T;
function required<T>(value: T | undefined, name: string): T {
    if (value === undefined)
        throw new Error(`${name} not found`);
    return value;
}
/** Hydrate the immutable viewer once. Queries project this small local library;
 * no full-table native bridge traffic is needed for each filter keystroke.
 * Recreate this adapter after bootstrap. Editing will require invalidating it.
 */
export async function createSqliteReadData(db: SqlDatabase, today: string | (() => string) = getToday): Promise<ReadData> {
    const countries = (await db.query<Row<{ uuid: string }>>('SELECT id, uuid, data FROM countries')).map(row => ({ id: row.id, uuid: row.uuid, name: String(JSON.parse(row.data).name) }));
    const byUuid = new Map(countries.map(c => [c.uuid, { id: c.id, name: c.name }]));
    const authors = (await db.query<Row<object>>('SELECT id, data FROM authors')).map(row => (() => { const data = JSON.parse(row.data) as Live<'authors'>; const selected = data.countryIds.map(id => required(byUuid.get(id), 'Country')).sort((a,b) => a.name.localeCompare(b.name)); return { id: row.id, ...data, countries: selected, country: selected.map(c => c.name).join(', ') || null }; })());
    const genres = (await db.query<Row<object>>('SELECT id, data FROM genres')).map(row => ({ id: row.id, ...JSON.parse(row.data) as Live<'genres'> }));
    const tags = (await db.query<Row<object>>('SELECT id, data FROM tags')).map(row => ({ id: row.id, name: (JSON.parse(row.data) as Live<'tags'>).name }));
    const selections = await db.query<{
        book_id: number;
        tag_id: number;
    }>('SELECT s.book_id, t.tag_id FROM book_tag_sets s JOIN book_tags t ON t.selection_id = s.id');
    const rawReadings = (await db.query<Row<{
        book_id: number;
    }>>('SELECT id, data, book_id FROM readings')).map(row => {
        const { bookId: _uuid, ...data } = JSON.parse(row.data) as Live<'readings'>;
        void _uuid;
        return { id: row.id, bookId: row.book_id, ...data };
    });
    const authorsById = new Map(authors.map(a => [a.id, a]));
    const genresById = new Map(genres.map(g => [g.id, g]));
    const tagsById = new Map(tags.map(t => [t.id, t]));
    const selectionsByBook = new Map<number, typeof selections>();
    for (const selection of selections) {
        const group = selectionsByBook.get(selection.book_id) ?? [];
        group.push(selection);
        selectionsByBook.set(selection.book_id, group);
    }
    const books: BookDetail[] = (await db.query<Row<{
        author_id: number;
        genre_id: number;
    }>>('SELECT id, data, author_id, genre_id FROM books')).map(row => {
        const { authorId: _author, genreId: _genre, ...data } = JSON.parse(row.data) as Live<'books'>;
        void _author;
        void _genre;
        return { id: row.id, ...data, author: required(authorsById.get(row.author_id), 'Author'), genre: required(genresById.get(row.genre_id), 'Genre'), tags: (selectionsByBook.get(row.id) ?? []).map(s => required(tagsById.get(s.tag_id), 'Tag')).sort((a, b) => a.name.localeCompare(b.name)) };
    });
    return createLibraryReadData({ authors, countries, genres, tags, books, rawReadings }, today);
}
