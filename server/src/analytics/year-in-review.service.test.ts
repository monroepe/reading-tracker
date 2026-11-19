import { describe, expect, it, vi } from 'vitest';
import { getYearInReview, rankReviewReadings, type ReviewReading } from './year-in-review.service.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]): Promise<{ rows: unknown[][] }> => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
    const { drizzle } = await import('drizzle-orm/pg-proxy');
    return { db: drizzle(execute) };
});

const excluded = { includeGraphicNovelsInBooks: false, includeGraphicNovelsInAuthors: false };
const reading = (overrides: Partial<ReviewReading> = {}): ReviewReading => ({
    readingId: 1, bookId: 1, title: 'A book', authorId: 1,
    firstName: 'Jane', middleName: '', lastName: 'Austen', format: 'Print', finishedOn: '2025-01-01', rating: 9, pageCount: 300,
    ...overrides,
});

describe('review rankings', () => {
    it('uses the latest reading within the supplied year, even when its rating is lower', () => {
        const result = rankReviewReadings([
            reading({ rating: 10 }), reading({ readingId: 2, finishedOn: '2025-02-01', rating: 7 }),
        ], excluded);
        expect(result.topBooks).toHaveLength(1);
        expect(result.topBooks[0]?.rating).toBe(7);
        expect(result.topAuthors[0]?.bookCount).toBe(1);
    });

    it('omits books whose latest reading is unrated and uses reading ID to break date ties', () => {
        expect(rankReviewReadings([reading({ readingId: 2, rating: null }), reading()], excluded).topBooks).toEqual([]);
    });

    it('filters graphic novels before selecting the latest reading', () => {
        const rows = [reading(), reading({ readingId: 2, format: 'Graphic Novel', rating: 10 })];
        expect(rankReviewReadings(rows, excluded).topBooks[0]?.rating).toBe(9);
        expect(rankReviewReadings(rows, { ...excluded, includeGraphicNovelsInBooks: true }).topBooks[0]?.rating).toBe(10);
    });

    it('controls inclusion independently for both rankings', () => {
        const rows = [reading({ format: 'Graphic Novel' })];
        expect(rankReviewReadings(rows, excluded)).toEqual({ topBooks: [], topAuthors: [] });
        const booksOnly = rankReviewReadings(rows, { ...excluded, includeGraphicNovelsInBooks: true });
        expect(booksOnly.topBooks).toHaveLength(1);
        expect(booksOnly.topAuthors).toEqual([]);
        const authorsOnly = rankReviewReadings(rows, { ...excluded, includeGraphicNovelsInAuthors: true });
        expect(authorsOnly.topBooks).toEqual([]);
        expect(authorsOnly.topAuthors).toHaveLength(1);
    });

    it('counts unique books and ranks authors by count', () => {
        const rows = [reading(), reading({ readingId: 2 }),
            reading({ bookId: 2, authorId: 2 }), reading({ bookId: 3, authorId: 2 })];
        expect(rankReviewReadings(rows, excluded).topAuthors.map((item) => [item.authorId, item.bookCount]))
            .toEqual([[2, 2], [1, 1]]);
    });

    it('caps both lists at 10 with stable alphabetical and ID tie breakers', () => {
        const rows = Array.from({ length: 12 }, (_, index) => reading({
            bookId: index + 1, authorId: index + 1,
            title: index === 11 ? 'Z book' : 'A book', lastName: index === 11 ? 'Zulu' : 'Austen',
        })).reverse();
        const result = rankReviewReadings(rows, excluded);
        expect(result.topBooks.map((item) => item.bookId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(result.topAuthors.map((item) => item.authorId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('returns empty rankings without eligible readings', () => {
        expect(rankReviewReadings([], excluded)).toEqual({ topBooks: [], topAuthors: [] });
    });
});

describe('review database scope', () => {
    it('scopes every query to the current user and completed, non-abandoned readings within date bounds', async () => {
        const report = await getYearInReview(42, { year: 2025, ...excluded });
        expect(report).toMatchObject({ year: 2025, total: 0, totalPages: 0, topBooks: [], topAuthors: [], byTag: [] });
        expect(execute).toHaveBeenCalledTimes(5);
        for (const [query, params] of execute.mock.calls) {
            expect(query).toContain('"readings"."user_id" =');
            expect(query).toContain('"readings"."abandoned" =');
            expect(query).toContain('"readings"."finished_on" >=');
            expect(query).toContain('"readings"."finished_on" <');
            expect(query).not.toContain('started_on');
            expect(params).toEqual(query.includes('\"book_tags\"') ? [42, 42, false, '2025-01-01', '2026-01-01', false] : [42, false, '2025-01-01', '2026-01-01', false]);
        }
        const tagQuery = execute.mock.calls.find(([query]) => query.includes('"book_tags"'));
        expect(tagQuery?.[0]).toContain('group by "tags"."name"');
    });
});

it('returns all-format totals and completed tag counts independently of ranking filters', async () => {
    execute.mockImplementation(async (query) => {
        if (query.includes('"readings"."id"')) return { rows: [
            [1, 1, 'Print book', 1, 'Jane', '', 'Austen', 'Print', '2025-01-01', '9.0', 300],
            [2, 1, 'Print book', 1, 'Jane', '', 'Austen', 'Print', '2025-02-01', '8.0', 300],
            [3, 2, 'Graphic book', 2, 'Other', '', 'Author', 'Graphic Novel', '2025-03-01', '10.0', 100],
        ] };
        if (query.includes('"book_tags"')) return { rows: [['Shared tag', 3]] };
        if (query.includes('group by "readings"."format"')) return { rows: [['Print', 2], ['Graphic Novel', 1]] };
        return { rows: [] };
    });
    const report = await getYearInReview(42, { year: 2025, ...excluded });
    expect(report.total).toBe(3);
    expect(report.totalPages).toBe(700);
    const included = await getYearInReview(42, { year: 2025, includeGraphicNovelsInBooks: true, includeGraphicNovelsInAuthors: true });
    expect(included.totalPages).toBe(700);
    expect(report.byFormat.find((row) => row.format === 'Graphic Novel')?.count).toBe(1);
    expect(report.byTag).toEqual([{ tag: 'Shared tag', count: 3 }]);
    expect(report.topBooks).toMatchObject([{ bookId: 1, rating: 8 }]);
    expect(report.topAuthors).toMatchObject([{ authorId: 1, bookCount: 1 }]);
});
