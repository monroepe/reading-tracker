import { countries, authorCountries } from '../db/schema.js';
import { and, count, countDistinct, desc, eq, exists, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authors, bookTags, books, genres, readings, tags } from '../db/schema.js';
import type { ReadingsByYearQuery, TopAuthorsQuery, TopBooksQuery } from './analytics.schema.js';

import { finishedInPeriod, type ReadingPeriod } from '../readings/reading-period.js';

const formats = ['Print', 'Kindle', 'Audiobook', 'Graphic Novel'] as const;

export async function getTopBooks(userId: number, filters: TopBooksQuery) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
        sql`${readings.rating} is not null`,
    ];
    if (!filters.includeGraphicNovels) conditions.push(ne(readings.format, 'Graphic Novel'));
    if (filters.genreId !== undefined) conditions.push(eq(books.genreId, filters.genreId));
    if (filters.tagId !== undefined) {
        conditions.push(exists(db.select({ id: bookTags.bookId }).from(bookTags).where(and(
            eq(bookTags.bookId, books.id),
            eq(bookTags.userId, userId),
            eq(bookTags.tagId, filters.tagId),
        ))));
    }

    const averageRating = sql<number>`avg(${readings.rating})`.mapWith(Number);
    return db.select({
        bookId: books.id,
        title: books.title,
        authorId: authors.id,
        firstName: authors.firstName,
        middleName: authors.middleName,
        lastName: authors.lastName,
        averageRating,
    }).from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .innerJoin(authors, eq(books.authorId, authors.id))
        .where(and(...conditions))
        .groupBy(books.id, books.title, authors.id, authors.firstName, authors.middleName, authors.lastName)
        .orderBy(desc(averageRating), books.title, books.id);
}

export async function getTopAuthors(
    userId: number,
    sort: TopAuthorsQuery['sort'] = 'books',
    includeGraphicNovels = false,
) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
    ];

    if (!includeGraphicNovels) {
        conditions.push(ne(readings.format, 'Graphic Novel'));
    }

    const bookCount = countDistinct(readings.bookId);
    const averageRating = sql<number | null>`avg(${readings.rating})`.mapWith(
        (value: string | null) => value === null ? null : Number(value),
    );
    const overallAverage = db
        .select({ average: sql`avg(${readings.rating})` })
        .from(readings)
        .where(and(...conditions));
    // Three books' worth of the user's overall average moderates small samples.
    // Keep the calculation numeric in PostgreSQL and round only for display.
    const weightedScore = sql<number | null>`
        (${bookCount} * ${averageRating} + 3 * (${overallAverage}))
        / (${bookCount} + 3)
    `.mapWith((value: string | null) => value === null ? null : Number(value));
    const ratingOrder = sql`${averageRating} desc nulls last`;
    const ranking = sort === 'rating'
        ? [sql`${weightedScore} desc nulls last`, desc(bookCount)]
        : [desc(bookCount), ratingOrder];

    return db
        .select({
            authorId: authors.id,
            firstName: authors.firstName,
            middleName: authors.middleName,
            lastName: authors.lastName,
            bookCount,
            averageRating,
            weightedScore,
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .innerJoin(authors, eq(books.authorId, authors.id))
        .where(and(...conditions))
        .groupBy(authors.id, authors.firstName, authors.middleName, authors.lastName)
        .having(sort === 'rating' ? sql`count(${readings.rating}) > 0` : undefined)
        .orderBy(
            ...ranking,
            sql`lower(${authors.lastName})`,
            sql`lower(${authors.firstName})`,
            sql`lower(${authors.middleName})`,
            authors.id,
        )
        .limit(10);
}

export async function getReadingsByFormat(userId: number, year?: ReadingPeriod) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
    ];

    if (year !== undefined) {
        conditions.push(finishedInPeriod(year)!);
    }

    const rows = await db
        .select({
            format: readings.format,
            count: count(),
        })
        .from(readings)
        .where(and(...conditions))
        .groupBy(readings.format);

    const counts = new Map(rows.map((row) => [row.format, row.count]));

    return formats.map((format) => ({
        format,
        count: counts.get(format) ?? 0,
    }));
}

export async function getReadingsByYear(
    userId: number,
    filters: ReadingsByYearQuery = {},
) {
    const { format, genreId, category } = filters;
    // 2021 is an internal grouping key; expose it only as pre-2022 below.
    const yearExpr = sql<number>`case when ${readings.finishedOn} < DATE '2022-01-01' then 2021 else extract(year from ${readings.finishedOn})::int end`;

    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
    ];

    if (format !== undefined) {
        conditions.push(eq(readings.format, format));
    }

    if (genreId !== undefined) {
        conditions.push(eq(books.genreId, genreId));
    }

    if (category !== undefined) {
        conditions.push(eq(books.category, category));
    }

    const rows = await db
        .select({
            year: yearExpr,
            count: count(),
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .where(and(...conditions))
        .groupBy(yearExpr)
        .orderBy(yearExpr);

    if (rows.length === 0) {
        return [];
    }

    const counts = new Map(rows.map((row) => [row.year, row.count]));
    const firstYear = rows[0].year;
    const lastYear = rows[rows.length - 1].year;

    const result: { year: ReadingPeriod; count: number }[] = [];
    for (let year = firstYear; year <= lastYear; year++) {
        result.push({ year: year === 2021 ? 'pre-2022' : year, count: counts.get(year) ?? 0 });
    }

    return result;
}

export async function getReadingsByCategory(userId: number, year?: ReadingPeriod) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
    ];

    if (year !== undefined) {
        conditions.push(finishedInPeriod(year)!);
    }

    return db
        .select({
            category: books.category,
            count: count(),
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .where(and(...conditions))
        .groupBy(books.category)
        .orderBy(books.category);
}

export async function getReadingsByGenre(userId: number, year?: ReadingPeriod) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
    ];

    if (year !== undefined) {
        conditions.push(finishedInPeriod(year)!);
    }

    return db
        .select({
            genre: genres.name,
            count: count(),
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .innerJoin(genres, eq(books.genreId, genres.id))
        .where(and(...conditions))
        .groupBy(genres.name)
        .orderBy(desc(count()), genres.name);
}

export async function getReadingsByTag(userId: number, year?: ReadingPeriod) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
    ];

    if (year !== undefined) {
        conditions.push(finishedInPeriod(year)!);
    }

    return db
        .select({
            tag: tags.name,
            count: count(),
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .innerJoin(bookTags, and(eq(books.id, bookTags.bookId), eq(bookTags.userId, userId)))
        .innerJoin(tags, eq(bookTags.tagId, tags.id))
        .where(and(...conditions))
        .groupBy(tags.name)
        .orderBy(desc(count()), tags.name);
}

export async function getReadingsByGender(userId: number, year?: ReadingPeriod) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
        sql`${authors.gender} is not null`,
    ];

    if (year !== undefined) {
        conditions.push(finishedInPeriod(year)!);
    }

    return db
        .select({
            gender: authors.gender,
            count: count(),
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .innerJoin(authors, eq(books.authorId, authors.id))
        .where(and(...conditions))
        .groupBy(authors.gender)
        .orderBy(desc(count()), authors.gender);
}

export async function getReadingsByCountry(userId: number, year?: ReadingPeriod) {
    const conditions = [
        eq(readings.userId, userId),
        eq(readings.abandoned, false),
        sql`${readings.finishedOn} is not null`,
        
    ];

    if (year !== undefined) {
        conditions.push(finishedInPeriod(year)!);
    }

    return db
        .select({
            country: countries.name,
            count: count(),
        })
        .from(readings)
        .innerJoin(books, eq(readings.bookId, books.id))
        .innerJoin(authors, eq(books.authorId, authors.id))
        .innerJoin(authorCountries, eq(authorCountries.authorId, authors.id))
        .innerJoin(countries, eq(countries.id, authorCountries.countryId))
        .where(and(...conditions))
        .groupBy(countries.name)
        .orderBy(desc(count()), countries.name);
}
