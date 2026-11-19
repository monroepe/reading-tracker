import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, isNotNull, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authors, books, genres, readings, countries, authorCountries } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';
import type { AuthorInput, AuthorListQuery, AuthorUpdate } from './authors.schemas.js';

const { syncId: _syncId, ...authorSelect } = getTableColumns(authors);

// Escape LIKE wildcards so user input is matched literally.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

function buildWhere({ q, country, gender }: AuthorListQuery) {
  const fullName = sql`concat_ws(' ', nullif(${authors.firstName}, ''), nullif(${authors.middleName}, ''), ${authors.lastName})`;
  return and(
    q ? or(ilike(fullName, `%${escapeLike(q)}%`), ilike(sql`concat_ws(' ', nullif(${authors.firstName}, ''), ${authors.lastName})`, `%${escapeLike(q)}%`)) : undefined,
    country ? sql`exists (select 1 from author_countries ac join countries c on c.id=ac.country_id where ac.author_id=${authors.id} and lower(c.name)=lower(${country}))` : undefined, // case-insensitive exact match
    gender ? eq(authors.gender, gender) : undefined,
  );
}

function buildOrderBy({ sort, order }: AuthorListQuery): SQL[] {
  const dir = order === 'asc' ? asc : desc;
  // `order` is enum-validated by zod, so sql.raw is safe here.
  const nullsLast = (col: SQLWrapper) => sql`${col} ${sql.raw(order)} nulls last`;

  const primary: Record<AuthorListQuery['sort'], SQL[]> = {
    name: [dir(authors.lastName), dir(authors.firstName), dir(authors.middleName)],
    firstName: [dir(authors.firstName), dir(authors.lastName)],
    country: [nullsLast(sql`(select min(c.name) from author_countries ac join countries c on c.id=ac.country_id where ac.author_id=${authors.id})`)],
    gender: [nullsLast(authors.gender)],
    bookCount: [dir(count(books.id))],
  };

  // Stable tiebreakers keep pagination deterministic.
  return [...primary[sort], asc(authors.lastName), asc(authors.firstName), asc(authors.middleName), asc(authors.id)];
}

export async function listAuthors(query: AuthorListQuery) {
  const { page, pageSize } = query;
  const where = buildWhere(query);

  const [data, [{ total }]] = await Promise.all([
    db
      .select({ ...authorSelect, bookCount: count(books.id) })
      .from(authors)
      .leftJoin(books, eq(books.authorId, authors.id))
      .where(where)
      .groupBy(authors.id)
      .orderBy(...buildOrderBy(query))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(authors).where(where),
  ]);

  return { data: await withCountries(data), total, page, pageSize };
}

/** Distinct, non-null countries A-Z, used to populate the country filter. */
export async function listAuthorCountries() {
  return (await db.select({ name: countries.name }).from(countries).orderBy(asc(countries.name))).map(c => c.name);
}
async function withCountries<T extends { id: number }>(rows: T[]) {
  if (!rows.length) return [];
  const links = await db.select({ authorId: authorCountries.authorId, id: countries.id, name: countries.name })
    .from(authorCountries).innerJoin(countries, eq(countries.id, authorCountries.countryId))
    .where(inArray(authorCountries.authorId, rows.map(r => r.id))).orderBy(asc(countries.name));
  const grouped = new Map<number, { id: number; name: string }[]>();
  for (const { authorId, ...country } of links) grouped.set(authorId, [...(grouped.get(authorId) ?? []), country]);
  return rows.map(row => ({ ...row, countries: grouped.get(row.id) ?? [], country: (grouped.get(row.id) ?? []).map(c => c.name).join(', ') || null }));
}

export async function getAuthor(id: number) {
  const [row] = await db.select(authorSelect).from(authors).where(eq(authors.id, id));
  if (!row) throw new HttpError(404, 'Author not found');
  return (await withCountries([row]))[0];
}

/** An author's books, each with the user's most recent reading (latest start date) and a reading count. */
export async function listAuthorBooks(userId: number, authorId: number) {
  await getAuthor(authorId); // 404 if the author doesn't exist

  const authorBooks = await db
    .select({
      id: books.id,
      title: books.title,
      coAuthors: books.coAuthors,
      category: books.category,
      pageCount: books.pageCount,
      genre: { id: genres.id, name: genres.name },
    })
    .from(books)
    .innerJoin(genres, eq(books.genreId, genres.id))
    .where(eq(books.authorId, authorId))
    .orderBy(asc(books.title), asc(books.id));

  if (authorBooks.length === 0) {
    return [];
  }

  const bookReadings = await db
    .select({
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
    .where(
      and(
        eq(readings.userId, userId),
        inArray(readings.bookId, authorBooks.map((book) => book.id)),
      ),
    )
    .orderBy(desc(readings.startedOn), desc(readings.id));

  // Newest first, so the first reading seen for a book is its latest.
  const latest = new Map<number, Omit<(typeof bookReadings)[number], 'bookId'>>();
  const counts = new Map<number, number>();
  for (const { bookId, ...reading } of bookReadings) {
    counts.set(bookId, (counts.get(bookId) ?? 0) + 1);
    if (!latest.has(bookId)) {
      latest.set(bookId, reading);
    }
  }

  return authorBooks.map((book) => ({
    ...book,
    readingCount: counts.get(book.id) ?? 0,
    lastReading: latest.get(book.id) ?? null,
  }));
}

export async function createAuthor(input: AuthorInput) {
  const { countryIds = [], ...fields } = input;
  const id = await db.transaction(async tx => {
    const [created] = await tx.insert(authors).values(fields).returning({ id: authors.id });
    if (countryIds.length) await tx.insert(authorCountries).values(countryIds.map(countryId => ({ authorId: created.id, countryId })));
    return created.id;
  });
  return getAuthor(id);
}
export async function updateAuthor(id: number, input: AuthorUpdate) {
  const { countryIds, ...fields } = input;
  await db.transaction(async tx => {
    const [existing] = await tx.select({ id: authors.id }).from(authors).where(eq(authors.id, id)).for('update');
    if (!existing) throw new HttpError(404, 'Author not found');
    if (Object.keys(fields).length) await tx.update(authors).set(fields).where(eq(authors.id, id));
    if (countryIds !== undefined) {
      await tx.delete(authorCountries).where(eq(authorCountries.authorId, id));
      if (countryIds.length) await tx.insert(authorCountries).values(countryIds.map(countryId => ({ authorId: id, countryId })));
    }
  });
  return getAuthor(id);
}

export async function deleteAuthor(id: number) {
  const [deleted] = await db.delete(authors).where(eq(authors.id, id)).returning(authorSelect);
  if (!deleted) throw new HttpError(404, 'Author not found');
}