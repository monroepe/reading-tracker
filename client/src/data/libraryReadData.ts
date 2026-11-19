import { localAnalytics } from './libraryAnalytics';
import type { ReadData } from './readData';
import type { Author, AuthorBook, AuthorListItem, Book, BookDetail, BookReading, Genre, Paged, Reading, Tag } from '@/api/types';
import { getToday } from '@/features/readings/utils/readingUtils';

const contains = (value: string, q?: string) => !q || value.toLocaleLowerCase().includes(q.toLocaleLowerCase());
const fullName = (a: Author) => [a.firstName, a.middleName, a.lastName].filter(Boolean).join(' ');
const shortName = (a: Author) => [a.firstName, a.lastName].filter(Boolean).join(' ');
type Value = string | number | null;
function compare(a: Value, b: Value, order: 'asc' | 'desc' = 'asc', nullsFirst = false): number {
    if (a === b)
        return 0;
    if (a === null)
        return nullsFirst ? -1 : 1;
    if (b === null)
        return nullsFirst ? 1 : -1;
    const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
    return order === 'desc' ? -result : result;
}
function sort<T>(rows: T[], fields: ((row: T) => Value)[], order: 'asc' | 'desc', ties: ((a: T, b: T) => number), nullsFirst = false) {
    return rows.sort((a, b) => {
        for (const field of fields) {
            const result = compare(field(a), field(b), order, nullsFirst);
            if (result)
                return result;
        }
        return ties(a, b);
    });
}
function page<T>(rows: T[], params: {
    page?: number;
    pageSize?: number;
}): Paged<T> {
    const page = params.page ?? 1, pageSize = params.pageSize ?? 25;
    return { data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}
function required<T>(value: T | undefined, name: string): T {
    if (value === undefined)
        throw new Error(`${name} not found`);
    return value;
}
export function createLibraryReadData(
    { authors, countries, genres, tags, books, rawReadings }: {
        authors: Author[];
        countries: Genre[];
        genres: Genre[];
        tags: Tag[];
        books: BookDetail[];
        rawReadings: (BookReading & { bookId: number })[];
    },
    today: string | (() => string) = getToday,
): ReadData {
    const readingsByBook = new Map<number, typeof rawReadings>();
    for (const reading of rawReadings) {
        const group = readingsByBook.get(reading.bookId) ?? [];
        group.push(reading);
        readingsByBook.set(reading.bookId, group);
    }
    const history = (bookId: number): BookReading[] => [...(readingsByBook.get(bookId) ?? [])]
        .sort((a, b) => compare(a.startedOn, b.startedOn, 'desc') || b.id - a.id)
        .map(({ bookId: _bookId, ...r }) => { void _bookId; return r; });
    const authorsById = new Map(authors.map(author => [author.id, author]));
    const booksById = new Map(books.map(b => [b.id, b]));
    const booksByAuthor = new Map<number, BookDetail[]>();
    for (const book of books) {
        const group = booksByAuthor.get(book.author.id) ?? [];
        group.push(book);
        booksByAuthor.set(book.author.id, group);
    }
    const bookList: Book[] = books.map((b) => {
        let latest: BookReading | null = null;
        for (const { bookId: _bookId, ...reading } of readingsByBook.get(b.id) ?? []) {
            void _bookId;
            if (reading.finishedOn !== null && (!latest || compare(reading.finishedOn, latest.finishedOn, 'desc') < 0 || (reading.finishedOn === latest.finishedOn && reading.id > latest.id))) latest = reading;
        }
        return { ...b, lastReading: latest };
    });
    const readingList: Reading[] = rawReadings.map(({ bookId, ...r }) => {
        const b = required(booksById.get(bookId), 'Book');
        const { author, genre, tags: _tags, ...book } = b;
        void _tags;
        return { ...r, book, author, genre, days: r.abandoned || r.dateUncertain ? null : Math.round((Date.parse(r.finishedOn ?? (typeof today === 'function' ? today() : today)) - Date.parse(r.startedOn)) / 86400000) };
    });
    const withCurrentDays = (r: Reading, currentDay = typeof today === 'function' ? today() : today): Reading => ({ ...r,
        days: r.abandoned || r.dateUncertain ? null : Math.round((Date.parse(r.finishedOn ?? currentDay) - Date.parse(r.startedOn)) / 86400000),
    });
    const authorList: AuthorListItem[] = authors.map(a => ({ ...a, bookCount: (booksByAuthor.get(a.id) ?? []).length }));
    const authorFields = [(a: Author) => a.lastName, (a: Author) => a.firstName, (a: Author) => a.middleName];
    return {
        analytics: localAnalytics(readingList, books),
        books: {
            detail: async (id) => required(booksById.get(id), 'Book'),
            readings: async (id) => { required(booksById.get(id), 'Book'); return history(id); },
            list: async (p) => {
                const rows = bookList.filter(b => contains(b.title, p.q) && (!p.search || [b.title, fullName(b.author as Author), shortName(b.author as Author), b.author.firstName, b.author.middleName, b.author.lastName].some(s => contains(s, p.search))) && (!p.authorId || b.author.id === p.authorId) && (!p.genreId || b.genre.id === p.genreId) && (!p.category || b.category === p.category) && (!p.tagIds?.length || b.tags.some(tag => p.tagIds!.includes(tag.id))));
                const fields: Record<string, ((b: Book) => Value)[]> = { title: [b => b.title], author: [b => b.author.lastName, b => b.author.firstName, b => b.author.middleName], genre: [b => b.genre.name], category: [b => b.category], pageCount: [b => b.pageCount], rating: [b => b.lastReading?.rating ?? null] };
                return page(sort(rows, fields[p.sort ?? 'title'], p.order ?? 'asc', (a, b) => compare(a.title, b.title) || a.id - b.id), p);
            },
        },
        authors: {
            detail: async (id) => required(authorsById.get(id), 'Author'),
            countries: async () => countries.map(c=>c.name).sort((a, b) => compare(a, b)),
            books: async (id) => {
                required(authorsById.get(id), 'Author');
                return [...(booksByAuthor.get(id) ?? [])].sort((a, b) => compare(a.title, b.title) || a.id - b.id).map(b => {
                    const readings = history(b.id);
                    const result: AuthorBook = { id: b.id, title: b.title, coAuthors: b.coAuthors, category: b.category, pageCount: b.pageCount, genre: b.genre, readingCount: readings.length, lastReading: readings[0] ?? null };
                    return result;
                });
            },
            list: async (p) => {
                const rows = authorList.filter(a => (!p.q || contains(fullName(a), p.q) || contains(shortName(a), p.q)) && (!p.country || (a.countries ?? []).some(c => c.name.toLowerCase() === p.country!.toLowerCase())) && (!p.gender || a.gender === p.gender));
                const fields: Record<string, ((a: AuthorListItem) => Value)[]> = { name: authorFields, firstName: [a => a.firstName, a => a.lastName], country: [a => a.countries?.[0]?.name ?? null], gender: [a => a.gender], bookCount: [a => a.bookCount] };
                return page(sort(rows, fields[p.sort ?? 'name'], p.order ?? 'asc', (a, b) => compare(a.lastName, b.lastName) || compare(a.firstName, b.firstName) || compare(a.middleName, b.middleName) || a.id - b.id), p);
            },
        },
        readings: { detail: async id => withCurrentDays(required(readingList.find(r => r.id === id), 'Reading')), list: async (p) => {
                const currentDay = typeof today === 'function' ? today() : today;
                const currentReadings = readingList.map(r => withCurrentDays(r, currentDay));
                const rows = currentReadings.filter(r => r.abandoned === (p.abandoned ?? false) && contains(r.book.title, p.q) && (!p.authorId || r.author.id === p.authorId) && (!p.genreId || r.genre.id === p.genreId) && (!p.category || r.book.category === p.category) && (!p.format || r.format === p.format) && (p.year === undefined || p.abandoned || (p.year === 'pre-2022' ? !!r.finishedOn && r.finishedOn < '2022-01-01' : !r.dateUncertain && Number((r.finishedOn ?? currentDay).slice(0, 4)) === p.year)));
                const fields: Record<string, ((r: Reading) => Value)[]> = { title: [r => r.book.title], author: [r => r.author.lastName, r => r.author.firstName, r => r.author.middleName], genre: [r => r.genre.name], category: [r => r.book.category], pageCount: [r => r.book.pageCount], format: [r => r.format], startedOn: [r => r.startedOn], finishedOn: [r => r.finishedOn], days: [r => r.days], rating: [r => r.rating] };
                return page(sort(rows, fields[p.sort ?? 'finishedOn'], p.order ?? 'desc', (a, b) => compare(a.startedOn, b.startedOn, 'desc') || a.id - b.id, (p.sort ?? 'finishedOn') === 'finishedOn' && (p.order ?? 'desc') === 'desc'), p);
            } },
        countries: { list: async () => countries.map(({ id, name }) => ({ id, name })).sort((a,b) => compare(a.name,b.name)) },
        genres: { list: async () => [...genres].sort((a, b) => compare(a.name, b.name)) },
        tags: { list: async (p) => page(tags.filter(t => contains(t.name, p.q)).sort((a: Tag, b: Tag) => compare(a.name, b.name) || a.id - b.id), p) },
    };
}
