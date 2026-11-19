import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authors, books, bookTags, readings, tags } from '../db/schema.js';
import { getReadingsByCategory, getReadingsByFormat, getReadingsByGenre } from './analytics.service.js';
import { finishedInPeriod } from '../readings/reading-period.js';
import type { YearInReviewQuery } from './analytics.schema.js';

export type ReviewReading = {
    readingId: number;
    bookId: number;
    title: string;
    authorId: number;
    firstName: string;
    middleName: string;
    lastName: string;
    format: string;
    finishedOn: string;
    rating: number | null;
    pageCount: number;
};

type RankingOptions = Pick<YearInReviewQuery, 'includeGraphicNovelsInBooks' | 'includeGraphicNovelsInAuthors'>;

export function rankReviewReadings(rows: ReviewReading[], options: RankingOptions) {
    const latestBooks = new Map<number, ReviewReading>();
    const authorBooks = new Map<number, { authorId: number; firstName: string; middleName: string; lastName: string; books: Set<number> }>();

    for (const row of rows) {
        if (options.includeGraphicNovelsInBooks || row.format !== 'Graphic Novel') {
            const previous = latestBooks.get(row.bookId);
            if (!previous || row.finishedOn > previous.finishedOn ||
                (row.finishedOn === previous.finishedOn && row.readingId > previous.readingId)) {
                latestBooks.set(row.bookId, row);
            }
        }
        if (options.includeGraphicNovelsInAuthors || row.format !== 'Graphic Novel') {
            let author = authorBooks.get(row.authorId);
            if (!author) {
                author = { authorId: row.authorId, firstName: row.firstName, middleName: row.middleName, lastName: row.lastName, books: new Set() };
                authorBooks.set(row.authorId, author);
            }
            author.books.add(row.bookId);
        }
    }

    const topBooks = [...latestBooks.values()]
        .filter((row): row is ReviewReading & { rating: number } => row.rating !== null)
        .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title) || a.bookId - b.bookId)
        .slice(0, 10)
        .map(({ bookId, title, authorId, firstName, middleName, lastName, rating }) =>
            ({ bookId, title, authorId, firstName, middleName, lastName, rating }));
    const topAuthors = [...authorBooks.values()]
        .map(({ books: uniqueBooks, ...author }) => ({ ...author, bookCount: uniqueBooks.size }))
        .sort((a, b) => b.bookCount - a.bookCount || a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName) || a.middleName.localeCompare(b.middleName) || a.authorId - b.authorId)
        .slice(0, 10);

    return { topBooks, topAuthors };
}

export async function getYearInReview(userId: number, query: YearInReviewQuery) {
    const { year } = query;
    const completedInYear = and(
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        finishedInPeriod(year),
    );
    const [reviewReadings, byFormat, byCategory, byGenre, byTag] = await Promise.all([
        db.select({
            readingId: readings.id,
            bookId: books.id,
            title: books.title,
            authorId: authors.id,
            firstName: authors.firstName,
            middleName: authors.middleName,
            lastName: authors.lastName,
            format: readings.format,
            finishedOn: readings.finishedOn,
            rating: readings.rating,
            pageCount: books.pageCount,
        }).from(readings)
            .innerJoin(books, eq(readings.bookId, books.id))
            .innerJoin(authors, eq(books.authorId, authors.id))
            .where(completedInYear),
        getReadingsByFormat(userId, year),
        getReadingsByCategory(userId, year),
        getReadingsByGenre(userId, year),
        db.select({ tag: tags.name, count: count() }).from(readings)
            .innerJoin(bookTags, and(eq(readings.bookId, bookTags.bookId), eq(bookTags.userId, userId)))
            .innerJoin(tags, eq(bookTags.tagId, tags.id))
            .where(completedInYear)
            .groupBy(tags.name)
            .orderBy(desc(count()), tags.name),
    ]);

    // The date bounds above exclude null finish dates; narrow the inferred database type.
    const completedReadings = reviewReadings.filter((row): row is ReviewReading => row.finishedOn !== null);
    return {
        year,
        total: byFormat.reduce((total, row) => total + row.count, 0),
        totalPages: completedReadings.reduce((total, row) => total + row.pageCount, 0),
        ...rankReviewReadings(completedReadings, query),
        byFormat,
        byCategory,
        byGenre,
        byTag,
    };
}
