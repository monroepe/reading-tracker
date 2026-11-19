import type { SnapshotExchange, SnapshotRecord } from './snapshot';
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function fixture(): SnapshotExchange {
    const record = (entityType: SnapshotRecord['entityType'], id: number, data: unknown) => ({ entityType, entityId: uuid(id), revision: uuid(id + 100), data }) as SnapshotRecord;
    return {
        format: 'reading-tracker', version: 2, kind: 'snapshot', transferId: uuid(1), sourceDeviceId: uuid(2), destinationDeviceId: null, libraryId: uuid(3),
        records: [
            record('countries', 70, { name: 'USA' }),
            record('authors', 10, { firstName: 'Ursula', middleName: 'K.', lastName: 'Le Guin', countryIds: [uuid(70)], gender: 'Female' }),
            record('authors', 11, { firstName: 'Octavia', middleName: '', lastName: 'Butler', countryIds: [], gender: 'Female' }),
            record('genres', 20, { name: 'Science fiction' }),
            record('tags', 30, { name: 'Favorite', ownedByLibrary: false }),
            record('books', 40, { title: 'The Dispossessed', authorId: uuid(10), genreId: uuid(20), coAuthors: null, category: 'Fiction', pageCount: 300 }),
            record('books', 41, { title: 'Kindred', authorId: uuid(11), genreId: uuid(20), coAuthors: null, category: 'Fiction', pageCount: 250 }),
            record('books', 42, null),
            record('bookTags', 50, { bookId: uuid(40), tagIds: [uuid(30)] }),
            record('bookTags', 51, { bookId: uuid(41), tagIds: [] }),
            record('readings', 60, { bookId: uuid(40), startedOn: '2026-01-01', finishedOn: '2026-01-10', dateUncertain: false, abandoned: false, format: 'Print', rating: 8.5, review: 'A review' }),
            record('readings', 61, { bookId: uuid(40), startedOn: '2026-11-01', finishedOn: null, dateUncertain: false, abandoned: false, format: 'Kindle', rating: null, review: null }),
            record('readings', 62, { bookId: uuid(41), startedOn: '2020-01-01', finishedOn: '2020-01-01', dateUncertain: true, abandoned: false, format: 'Print', rating: 9, review: null }),
            record('readings', 63, { bookId: uuid(41), startedOn: '2026-02-01', finishedOn: null, dateUncertain: false, abandoned: true, format: 'Print', rating: null, review: null }),
        ],
    };
}
