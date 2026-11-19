import { and, asc, count, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authors, books, genres, readings } from '../db/schema.js';
import { finishedInPeriod } from './reading-period.js';
import { HttpError } from '../middleware/errors.js';
import type { ReadingInput, ReadingListQuery, ReadingUpdate } from './readings.schemas.js';

// Escape LIKE wildcards so user input is matched literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

// Days to read: finish minus start, or today minus start while in progress. Null if abandoned.
const daysExpr = sql`case when ${readings.abandoned} or ${readings.dateUncertain} then null else coalesce(${readings.finishedOn}, current_date) - ${readings.startedOn} end`;

const readingSelect = {
  id: readings.id,
  startedOn: readings.startedOn,
  finishedOn: readings.finishedOn,
  dateUncertain: readings.dateUncertain,
  abandoned: readings.abandoned,
  format: readings.format,
  rating: readings.rating,
  review: readings.review,
  days: sql<number | null>`${daysExpr}`.mapWith(Number),
  book: {
    id: books.id,
    title: books.title,
    coAuthors: books.coAuthors,
    category: books.category,
    pageCount: books.pageCount,
  },
  author: { id: authors.id, firstName: authors.firstName, middleName: authors.middleName, lastName: authors.lastName },
  genre: { id: genres.id, name: genres.name },
};

function baseQuery() {
  return db
    .select(readingSelect)
    .from(readings)
    .innerJoin(books, eq(readings.bookId, books.id))
    .innerJoin(authors, eq(books.authorId, authors.id))
    .innerJoin(genres, eq(books.genreId, genres.id));
}

const owned = (userId: number, id: number) =>
  and(eq(readings.id, id), eq(readings.userId, userId));

// Default view excludes abandoned readings. The year is the finish year,
// or the current year while in progress; it is ignored for the abandoned view.
// Only references columns on `readings` and `books`, so the count query joins just books.
function buildWhere(
  userId: number,
  { q, authorId, year, abandoned = false, format, genreId, category }: ReadingListQuery,
) {
  return and(
    eq(readings.userId, userId),
    eq(readings.abandoned, abandoned),
    q ? ilike(books.title, `%${escapeLike(q)}%`) : undefined,
    authorId ? eq(books.authorId, authorId) : undefined,
    year !== undefined && !abandoned
      ? year === 'pre-2022'
        ? finishedInPeriod(year)
        : and(eq(readings.dateUncertain, false), sql`extract(year from coalesce(${readings.finishedOn}, current_date)) = ${year}`)
      : undefined,
    format ? eq(readings.format, format) : undefined,
    genreId ? eq(books.genreId, genreId) : undefined,
    category ? eq(books.category, category) : undefined,
  );
}

function buildOrderBy({ sort, order }: ReadingListQuery): SQL[] {
  const dir = order === 'asc' ? asc : desc;
  // `order` is already restricted to asc | desc, and is mapped here before reaching sql.raw.
  const rawDir = sql.raw(order === 'asc' ? 'asc' : 'desc');
  const nullsLast = (expr: SQL | typeof readings.finishedOn | typeof readings.rating) =>
    sql`${expr} ${rawDir} nulls last`;

  // An unfinished reading counts as the newest: first on desc, last on asc.
  const unfinishedAsNewest = sql`${readings.finishedOn} ${rawDir} nulls ${sql.raw(
    order === 'asc' ? 'last' : 'first',
  )}`;

  const primary: Record<ReadingListQuery['sort'], SQL[]> = {
    title: [dir(books.title)],
    author: [dir(authors.lastName), dir(authors.firstName), dir(authors.middleName)],
    genre: [dir(genres.name)],
    category: [dir(books.category)],
    pageCount: [dir(books.pageCount)],
    format: [dir(readings.format)],
    startedOn: [dir(readings.startedOn)],
    finishedOn: [unfinishedAsNewest],
    days: [nullsLast(daysExpr)],
    rating: [nullsLast(readings.rating)],
  };

  // Stable tiebreakers keep pagination deterministic.
  return [...primary[sort], desc(readings.startedOn), asc(readings.id)];
}

export async function listReadings(userId: number, query: ReadingListQuery) {
  const { page, pageSize } = query;
  const where = buildWhere(userId, query);

  const [data, [{ total }]] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(...buildOrderBy(query))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(readings)
      .innerJoin(books, eq(readings.bookId, books.id))
      .where(where),
  ]);

  return { data, total, page, pageSize };
}

export async function getReading(userId: number, id: number) {
  const [row] = await baseQuery().where(owned(userId, id));
  if (!row) {
    throw new HttpError(404, 'Reading not found');
  }
  return row;
}

export async function createReading(userId: number, input: ReadingInput) {
  const [created] = await db
    .insert(readings)
    .values({ ...input, userId })
    .returning({ id: readings.id });
  return getReading(userId, created.id);
}

export async function updateReading(userId: number, id: number, input: ReadingUpdate) {
  const [updated] = await db
    .update(readings)
    .set(input)
    .where(and(owned(userId, id),
      input.startedOn !== undefined || input.finishedOn !== undefined || input.abandoned !== undefined
        ? eq(readings.dateUncertain, false) : undefined,
    ))
    .returning({ id: readings.id });
  if (!updated) {
    const existing = await getReading(userId, id);
    if (existing.dateUncertain) throw new HttpError(400, 'Imported uncertain dates cannot be edited');
    throw new HttpError(404, 'Reading not found');
  }
  return getReading(userId, id);
}

export async function deleteReading(userId: number, id: number) {
  const [deleted] = await db
    .delete(readings)
    .where(owned(userId, id))
    .returning({ id: readings.id });
  if (!deleted) {
    throw new HttpError(404, 'Reading not found');
  }
}