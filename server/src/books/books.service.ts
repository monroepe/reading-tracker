import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from 'drizzle-orm';

import { db } from '../db/index.js';
import { authors, bookTags, books, genres, readings, tags } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';

import type { BookInput, BookListQuery, BookUpdate } from './books.schemas.js';

// Escape LIKE wildcards so user input is matched literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

const bookSelect = {
  id: books.id,
  title: books.title,
  coAuthors: books.coAuthors,
  category: books.category,
  pageCount: books.pageCount,
  author: { id: authors.id, firstName: authors.firstName, middleName: authors.middleName, lastName: authors.lastName },
  genre: { id: genres.id, name: genres.name },
};

type LastReading = Pick<
  typeof readings.$inferSelect,
  'id' | 'startedOn' | 'finishedOn' | 'dateUncertain' | 'abandoned' | 'format' | 'rating' | 'review'
>;

// The user's latest finished reading per book (ties broken by the highest id).
// One row per book, so joining it never changes the number of books returned.
function latestFinishedReadings(userId: number) {
  return db
    .selectDistinctOn([readings.bookId], {
      id: readings.id,
      bookId: readings.bookId,
      startedOn: readings.startedOn,
      finishedOn: readings.finishedOn,
      dateUncertain: readings.dateUncertain,
      abandoned: readings.abandoned,
      format: readings.format,
      rating: readings.rating,
      review: readings.review,
    })
    .from(readings)
    .where(and(eq(readings.userId, userId), isNotNull(readings.finishedOn)))
    .orderBy(readings.bookId, desc(readings.finishedOn), desc(readings.id))
    .as('last_readings');
}

// `q` matches the title only. `search` matches the title or the author's name.
// References columns on `books` and `authors`, so the count query must join authors too.
function buildWhere(userId: number, { q, search, authorId, genreId, category, tagIds }: BookListQuery) {
  const searchPattern = search ? `%${escapeLike(search)}%` : undefined;

  return and(
    q ? ilike(books.title, `%${escapeLike(q)}%`) : undefined,
    searchPattern
      ? or(
        ilike(books.title, searchPattern),
        ilike(authors.firstName, searchPattern),
        ilike(authors.lastName, searchPattern),
        ilike(authors.middleName, searchPattern),
        ilike(sql`concat_ws(' ', nullif(${authors.firstName}, ''), nullif(${authors.middleName}, ''), ${authors.lastName})`, searchPattern),
        ilike(sql`concat_ws(' ', nullif(${authors.firstName}, ''), ${authors.lastName})`, searchPattern),
      )
      : undefined,
    authorId ? eq(books.authorId, authorId) : undefined,
    genreId ? eq(books.genreId, genreId) : undefined,
    category ? eq(books.category, category) : undefined,
    tagIds && tagIds.length > 0
      ? inArray(
        books.id,
        db
          .select({ bookId: bookTags.bookId })
          .from(bookTags)
          .where(and(eq(bookTags.userId, userId), inArray(bookTags.tagId, tagIds))),
      )
      : undefined,
  );
}

function buildOrderBy({ sort, order }: BookListQuery, ratingColumn: SQLWrapper): SQL[] {
  const dir = order === 'asc' ? asc : desc;
  // `order` is enum-validated by zod, so sql.raw is safe here.
  const nullsLast = (col: SQLWrapper) => sql`${col} ${sql.raw(order)} nulls last`;

  const primary: Record<BookListQuery['sort'], SQL[]> = {
    title: [dir(books.title)],
    author: [dir(authors.lastName), dir(authors.firstName), dir(authors.middleName)],
    genre: [dir(genres.name)],
    category: [dir(books.category)],
    pageCount: [dir(books.pageCount)],
    rating: [nullsLast(ratingColumn)],
  };

  // Stable tiebreakers keep pagination deterministic.
  return [...primary[sort], asc(books.title), asc(books.id)];
}

// Readings are user-owned, so `lastReading` is scoped to the logged-in user.
export async function listBooks(userId: number, query: BookListQuery) {
  const { page, pageSize } = query;
  const where = buildWhere(userId, query);
  const lastReadings = latestFinishedReadings(userId);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        ...bookSelect,
        lastReading: {
          id: lastReadings.id,
          startedOn: lastReadings.startedOn,
          finishedOn: lastReadings.finishedOn,
          dateUncertain: lastReadings.dateUncertain,
          abandoned: lastReadings.abandoned,
          format: lastReadings.format,
          rating: lastReadings.rating,
          review: lastReadings.review,
        },
      })
      .from(books)
      .innerJoin(authors, eq(books.authorId, authors.id))
      .innerJoin(genres, eq(books.genreId, genres.id))
      .leftJoin(lastReadings, eq(lastReadings.bookId, books.id))
      .where(where)
      .orderBy(...buildOrderBy(query, lastReadings.rating))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(books)
      .innerJoin(authors, eq(books.authorId, authors.id))
      .where(where),
  ]);

  const pageTags = rows.length ? await db
    .select({ bookId: bookTags.bookId, id: tags.id, name: tags.name })
    .from(bookTags)
    .innerJoin(tags, eq(bookTags.tagId, tags.id))
    .where(and(eq(bookTags.userId, userId), inArray(bookTags.bookId, rows.map(row => row.id))))
    .orderBy(asc(tags.name)) : [];

  // Drizzle types the left-joined object as possibly null (a book with no finished reading).
  // The columns inside are non-null whenever the object itself is present.
  const data = rows.map(({ lastReading, ...book }) => ({
    ...book,
    lastReading: lastReading as LastReading | null,
    tags: pageTags.filter(tag => tag.bookId === book.id).map(({ id, name }) => ({ id, name })),
  }));

  return { data, total, page, pageSize };
}

export async function getBook(userId: number, id: number) {
  const [row] = await db
    .select(bookSelect)
    .from(books)
    .innerJoin(authors, eq(books.authorId, authors.id))
    .innerJoin(genres, eq(books.genreId, genres.id))
    .where(eq(books.id, id));

  if (!row) {
    throw new HttpError(404, 'Book not found');
  }

  const bookTagRows = await db
    .select({ id: tags.id, name: tags.name })
    .from(bookTags)
    .innerJoin(tags, eq(bookTags.tagId, tags.id))
    .where(and(eq(bookTags.bookId, id), eq(bookTags.userId, userId)))
    .orderBy(asc(tags.name));

  return { ...row, tags: bookTagRows };
}

// Readings are user-owned, so they are scoped to the logged-in user.
export async function listBookReadings(userId: number, bookId: number) {
  await getBook(userId, bookId);

  return db
    .select({
      id: readings.id,
      startedOn: readings.startedOn,
      finishedOn: readings.finishedOn,
      dateUncertain: readings.dateUncertain,
      abandoned: readings.abandoned,
      format: readings.format,
      rating: readings.rating,
      review: readings.review,
    })
    .from(readings)
    .where(and(eq(readings.userId, userId), eq(readings.bookId, bookId)))
    .orderBy(desc(readings.startedOn), desc(readings.id));
}

export async function createBook(userId: number, input: BookInput) {
  const { tagIds = [], ...fields } = input;
  const id = await db.transaction(async (tx) => {
    const [created] = await tx.insert(books).values(fields).returning({ id: books.id });
    if (tagIds.length > 0) {
      await tx.insert(bookTags).values(tagIds.map((tagId) => ({ userId, bookId: created.id, tagId })));
    }
    return created.id;
  });
  return getBook(userId, id);
}

export async function updateBook(userId: number, id: number, input: BookUpdate) {
  const { tagIds, ...fields } = input;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: books.id }).from(books).where(eq(books.id, id)).for('update');
    if (!existing) {
      throw new HttpError(404, 'Book not found');
    }
    if (Object.keys(fields).length > 0) {
      await tx.update(books).set(fields).where(eq(books.id, id));
    }
    if (tagIds) {
      await tx.delete(bookTags).where(and(eq(bookTags.bookId, id), eq(bookTags.userId, userId)));
      if (tagIds.length > 0) {
        await tx.insert(bookTags).values(tagIds.map((tagId) => ({ userId, bookId: id, tagId })));
      }
    }
  });
  return getBook(userId, id);
}

export async function deleteBook(id: number) {
  const [deleted] = await db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
  if (!deleted) {
    throw new HttpError(404, 'Book not found');
  }
}

// Serialize replacements for a book so concurrent saves never produce a merged tag set.
export async function replaceBookTags(userId: number, bookId: number, tagIds: number[]) {
  await db.transaction(async (tx) => {
    const [book] = await tx.select({ id: books.id }).from(books).where(eq(books.id, bookId)).for('update');
    if (!book) throw new HttpError(404, 'Book not found');
    await tx.delete(bookTags).where(and(eq(bookTags.userId, userId), eq(bookTags.bookId, bookId)));
    if (tagIds.length) await tx.insert(bookTags).values(tagIds.map((tagId) => ({ userId, bookId, tagId })));
  });
  return getBook(userId, bookId);
}
