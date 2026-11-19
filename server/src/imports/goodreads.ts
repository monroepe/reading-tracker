import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Client } from 'pg';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';

const id = z.number().int().positive();
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const counts = z.object({ authors: id, genres: id, books: id, readings: id });
const authorInput = z.object({
  csvAuthor: z.string().min(1), firstName: z.string(), middleName: z.string(),
  lastName: z.string().min(1), country: z.string().min(1),
  gender: z.enum(['Female', 'Male', 'Non-binary']),
});
const manifestInput = z.object({
  batchKey: z.string().min(1), userId: id, ownerSha256: checksum,
  originalCsvSha256: checksum, csvSha256: checksum, baselineCapturedAt: z.string(),
  baselineSha256: checksum, readingSchemaSha256: checksum, expectedBefore: counts,
  expectedAdditions: z.object({ authors: id, books: id, readings: id, uncertainReadings: id, datedReadings: id }),
  existingAuthorIds: z.record(z.string(), id), newAuthors: z.array(authorInput),
  genreIds: z.record(z.string(), id), existingBookIds: z.record(z.string(), id),
}).strict();
type Manifest = z.infer<typeof manifestInput>;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const csvInput = z.object({
  Title: z.string().trim().min(1), Author: z.string().trim().min(1),
  Genre: z.string().trim().min(1), Category: z.enum(['Fiction', 'Non-fiction']),
  'Additional Authors': z.string(),
  'Number of Pages': z.string().regex(/^\d+$/).transform(Number).pipe(id),
  'New Rating': z.string().trim().min(1).transform(Number)
    .pipe(z.number().min(0.5).max(10).multipleOf(0.5)),
  Format: z.enum(['Print', 'Kindle', 'Audiobook', 'Graphic Novel']),
  'Reviewed start': day, 'Reviewed finish': day,
  'Reviewed dateUncertain': z.enum(['TRUE', 'FALSE']).transform((value) => value === 'TRUE'),
  'Review Decision': z.enum(['', 'Read twice']), 'Delete Flag': z.literal(''),
}).refine((row) => row['Reviewed finish'] >= row['Reviewed start'], 'Finish precedes start')
  .refine((row) => !row['Reviewed dateUncertain'] || row['Reviewed finish'] < '2022-01-01',
    'Uncertain reading must finish before 2022');
type CsvRow = z.infer<typeof csvInput>;

interface Author {
  id: number; first_name: string; middle_name: string; last_name: string;
  country: string | null; gender: string | null;
}
interface Genre { id: number; name: string }
interface Book {
  id: number; title: string; author_id: number; genre_id: number;
  co_authors: string | null; category: string; page_count: number;
}
interface Reading {
  id: number; user_id: number; book_id: number; date_uncertain: boolean;
  started_on: string; finished_on: string | null; abandoned: boolean;
  format: string; rating: string | null; review: string | null;
}
interface Snapshot { authors: Author[]; genres: Genre[]; books: Book[]; readings: Reading[] }
interface InsertedIds { authors: number[]; books: number[]; readings: number[] }
interface Receipt {
  id: number; csv_sha256: string; mapping_sha256: string; inserted_ids: InsertedIds;
  inserted_sha256: string; completed_at: Date;
}

// Stable across PostgreSQL column order and JSON formatting. Array order remains significant.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const hashFile = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
const authorName = (author: Author) => [author.first_name, author.middle_name, author.last_name].filter(Boolean).join(' ');

export const defaultCsvPath = fileURLToPath(new URL('../../../docs/imports/goodreads/goodreads-reconciliation-review.csv', import.meta.url));
const manifestPath = fileURLToPath(new URL('../../../docs/imports/goodreads/goodreads-import-manifest.json', import.meta.url));

async function snapshot(client: Client, userId: number): Promise<Snapshot> {
  return {
    authors: (await client.query<Author>('SELECT * FROM authors ORDER BY id')).rows,
    genres: (await client.query<Genre>('SELECT * FROM genres ORDER BY id')).rows,
    books: (await client.query<Book>('SELECT * FROM books ORDER BY id')).rows,
    readings: (await client.query<Reading>('SELECT * FROM readings WHERE user_id=$1 ORDER BY id', [userId])).rows,
  };
}

async function schemaHash(client: Client) {
  const constraints = (await client.query(`SELECT conname,pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid='public.readings'::regclass ORDER BY conname`)).rows;
  const columns = (await client.query(`SELECT column_name,data_type,is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='readings' ORDER BY ordinal_position`)).rows;
  return hash({ constraints, columns });
}

function partition(snapshot: Snapshot, ids: InsertedIds) {
  const imported = {
    authors: snapshot.authors.filter((row) => ids.authors.includes(row.id)),
    books: snapshot.books.filter((row) => ids.books.includes(row.id)),
    readings: snapshot.readings.filter((row) => ids.readings.includes(row.id)),
  };
  const existing = {
    authors: snapshot.authors.filter((row) => !ids.authors.includes(row.id)),
    genres: snapshot.genres,
    books: snapshot.books.filter((row) => !ids.books.includes(row.id)),
    readings: snapshot.readings.filter((row) => !ids.readings.includes(row.id)),
  };
  return { imported, existing };
}

function planRows(rows: CsvRow[], manifest: Manifest, before: Snapshot) {
  const authors = new Map(before.authors.map((author) => [author.id, author]));
  const books = new Map(before.books.map((book) => [book.id, book]));
  const newAuthors = new Map(manifest.newAuthors.map((author) => [author.csvAuthor, author]));
  if (newAuthors.size !== manifest.newAuthors.length) throw new Error('Duplicate author mapping');
  const seen = new Set<string>();
  const usedAuthors = new Set<string>();
  const usedGenres = new Set<string>();
  const reusedBooks = new Set<string>();
  for (const [name, authorId] of Object.entries(manifest.existingAuthorIds)) {
    const author = authors.get(authorId);
    if (!author || normalize(authorName(author)) !== normalize(name)) throw new Error(`Author mapping changed: ${name}`);
  }
  for (const author of manifest.newAuthors) {
    const fullName = [author.firstName, author.middleName, author.lastName].filter(Boolean).join(' ');
    if (normalize(fullName) !== normalize(author.csvAuthor)
      || before.authors.some((existing) => normalize(authorName(existing)) === normalize(fullName))) {
      throw new Error(`New author needs review: ${author.csvAuthor}`);
    }
    if (manifest.existingAuthorIds[author.csvAuthor]) throw new Error(`Conflicting author mapping: ${author.csvAuthor}`);
  }
  for (const row of rows) {
    const identity = `${normalize(row.Author)}:${normalize(row.Title)}`;
    if (seen.has(identity)) throw new Error(`Duplicate input book/reading: ${row.Title}`);
    seen.add(identity);
    usedAuthors.add(row.Author);
    usedGenres.add(row.Genre);
    const authorId = manifest.existingAuthorIds[row.Author];
    if (!authorId && !newAuthors.has(row.Author)) throw new Error(`Missing author mapping: ${row.Author}`);
    const genreId = manifest.genreIds[row.Genre];
    if (!before.genres.some((genre) => genre.id === genreId && genre.name === row.Genre)) {
      throw new Error(`Genre mapping changed: ${row.Genre}`);
    }
    const bookId = manifest.existingBookIds[row.Title];
    if (bookId) {
      reusedBooks.add(row.Title);
      const book = books.get(bookId);
      if (!book || book.author_id !== authorId || normalize(book.title) !== normalize(row.Title)) {
        throw new Error(`Book mapping changed: ${row.Title}`);
      }
      if (row['Review Decision'] !== 'Read twice') throw new Error(`Existing book needs reread approval: ${row.Title}`);
    } else if (before.books.some((book) => book.author_id === authorId && normalize(book.title) === normalize(row.Title))) {
      throw new Error(`Unexpected existing book: ${row.Title}`);
    }
  }
  if (usedAuthors.size !== Object.keys(manifest.existingAuthorIds).length + newAuthors.size
    || usedGenres.size !== Object.keys(manifest.genreIds).length
    || reusedBooks.size !== Object.keys(manifest.existingBookIds).length) {
    throw new Error('Unused or missing entity mappings');
  }
  const additions = {
    authors: newAuthors.size,
    books: rows.length - reusedBooks.size,
    readings: rows.length,
    uncertainReadings: rows.filter((row) => row['Reviewed dateUncertain']).length,
    datedReadings: rows.filter((row) => !row['Reviewed dateUncertain']).length,
  };
  if (hash(additions) !== hash(manifest.expectedAdditions)) throw new Error('Addition counts differ from the reviewed plan');
  return {
    additions,
    reused: { authors: Object.keys(manifest.existingAuthorIds).length, books: reusedBooks.size, genres: usedGenres.size },
    authors: manifest.newAuthors,
    books: rows.map((row) => ({ title: row.Title, author: row.Author,
      action: manifest.existingBookIds[row.Title] ? 'reuse' : 'create',
      existingId: manifest.existingBookIds[row.Title] ?? null })),
  };
}

async function insertBatch(client: Client, rows: CsvRow[], manifest: Manifest) {
  const inserted: InsertedIds = { authors: [], books: [], readings: [] };
  const authorIds = { ...manifest.existingAuthorIds };
  const bookIds = { ...manifest.existingBookIds };
  for (const author of manifest.newAuthors) {
    const { rows: [created] } = await client.query<{ id: number }>(`INSERT INTO authors
      (first_name,middle_name,last_name,country,gender) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [author.firstName, author.middleName, author.lastName, author.country, author.gender]);
    authorIds[author.csvAuthor] = created.id;
    inserted.authors.push(created.id);
  }
  for (const row of rows) {
    let bookId = bookIds[row.Title];
    if (!bookId) {
      const { rows: [created] } = await client.query<{ id: number }>(`INSERT INTO books
        (title,author_id,co_authors,genre_id,category,page_count) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [row.Title, authorIds[row.Author], row['Additional Authors'].trim() || null,
        manifest.genreIds[row.Genre], row.Category, row['Number of Pages']]);
      bookId = created.id;
      bookIds[row.Title] = bookId;
      inserted.books.push(bookId);
    }
    const { rows: [created] } = await client.query<{ id: number }>(`INSERT INTO readings
      (user_id,book_id,started_on,finished_on,date_uncertain,abandoned,format,rating,review)
      VALUES ($1,$2,$3,$4,$5,false,$6,$7,NULL) RETURNING id`,
    [manifest.userId, bookId, row['Reviewed start'], row['Reviewed finish'],
      row['Reviewed dateUncertain'], row.Format, row['New Rating']]);
    inserted.readings.push(created.id);
  }
  return inserted;
}

function verifyInsertedValues(rows: CsvRow[], manifest: Manifest, after: Snapshot, ids: InsertedIds) {
  for (const [index, author] of manifest.newAuthors.entries()) {
    const actual = after.authors.find((record) => record.id === ids.authors[index]);
    if (!actual || actual.first_name !== author.firstName || actual.middle_name !== author.middleName
      || actual.last_name !== author.lastName || actual.country !== author.country || actual.gender !== author.gender) {
      throw new Error(`Inserted author differs from mapping: ${author.csvAuthor}; rolling back`);
    }
  }
  const books = new Map(after.books.map((book) => [book.id, book]));
  const authorIds = { ...manifest.existingAuthorIds };
  manifest.newAuthors.forEach((author, index) => { authorIds[author.csvAuthor] = ids.authors[index]!; });
  for (const [index, row] of rows.entries()) {
    const actual = after.readings.find((record) => record.id === ids.readings[index]);
    const book = actual ? books.get(actual.book_id) : undefined;
    if (!actual || !book || actual.user_id !== manifest.userId
      || actual.started_on !== row['Reviewed start'] || actual.finished_on !== row['Reviewed finish']
      || actual.date_uncertain !== row['Reviewed dateUncertain'] || actual.abandoned
      || actual.format !== row.Format || actual.rating === null || Number(actual.rating) !== row['New Rating']
      || actual.review !== null) {
      throw new Error(`Inserted reading differs from CSV: ${row.Title}; rolling back`);
    }
    const existingId = manifest.existingBookIds[row.Title];
    if (existingId) {
      if (book.id !== existingId) throw new Error(`Inserted reread references wrong book: ${row.Title}; rolling back`);
    } else if (!ids.books.includes(book.id) || book.title !== row.Title
      || book.author_id !== authorIds[row.Author] || book.genre_id !== manifest.genreIds[row.Genre]
      || book.co_authors !== (row['Additional Authors'].trim() || null)
      || book.category !== row.Category || book.page_count !== row['Number of Pages']) {
      throw new Error(`Inserted book differs from CSV: ${row.Title}; rolling back`);
    }
  }
}

export async function runGoodreadsImport(client: Client, options: {
  userId: number; csvPath: string; commit: boolean; verify: boolean;
}) {
  const manifest = manifestInput.parse(JSON.parse(await readFile(manifestPath, 'utf8')));
  if (options.userId !== manifest.userId) throw new Error(`This reviewed batch belongs to user ${manifest.userId}`);
  const csv = await readFile(options.csvPath);
  if (hashFile(csv) !== manifest.csvSha256) throw new Error('CSV checksum changed; review it before importing');
  const mappingSha256 = hash(manifest);
  const records = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as unknown[];
  const rows = records.map((record, index) => {
    const result = csvInput.safeParse(record);
    if (!result.success) throw new Error(`CSV record ${index + 1}: ${result.error.message}`);
    return result.data;
  });

  await client.query(options.commit ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    if (options.commit) {
      // Serialize this batch, then block catalogue/reading edits during the short import.
      await client.query("SET LOCAL lock_timeout = '10s'");
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1),$2)', [manifest.batchKey, manifest.userId]);
      await client.query('LOCK TABLE authors,genres,books,readings IN SHARE ROW EXCLUSIVE MODE');
      await client.query('LOCK TABLE users IN SHARE MODE');
    }
    const { rows: owners } = await client.query('SELECT id,email FROM users WHERE id=$1', [manifest.userId]);
    if (owners.length !== 1 || hash(owners[0]) !== manifest.ownerSha256) throw new Error('Target account differs from the reviewed owner');
    if (await schemaHash(client) !== manifest.readingSchemaSha256) throw new Error('Reading schema or constraints changed; review before importing');
    const receiptTableExists = (await client.query("SELECT to_regclass('public.import_receipts') IS NOT NULL AS present")).rows[0].present as boolean;
    const receipt = receiptTableExists
      ? (await client.query<Receipt>('SELECT * FROM import_receipts WHERE batch_key=$1 AND user_id=$2',
        [manifest.batchKey, manifest.userId])).rows[0] : undefined;
    const before = await snapshot(client, manifest.userId);
    if (receipt) {
      if (receipt.csv_sha256 !== manifest.csvSha256 || receipt.mapping_sha256 !== mappingSha256) {
        throw new Error('This batch already ran with different input/mappings; refusing another import');
      }
      const { imported } = partition(before, receipt.inserted_ids);
      if (hash(imported) !== receipt.inserted_sha256) throw new Error('Batch already imported, but imported records have changed or are missing; refusing another import');
      await client.query('ROLLBACK');
      return { status: 'already-imported', receiptId: receipt.id, completedAt: receipt.completed_at,
        insertedIds: receipt.inserted_ids, verification: 'Imported records match receipt; no writes performed' };
    }
    if (options.verify) throw new Error('No receipt exists: this batch has not been imported');
    if (hash(before) !== manifest.baselineSha256) throw new Error('Database records differ from the reviewed baseline; refresh the comparison before importing');
    const beforeCounts = Object.fromEntries(Object.entries(before).map(([table, values]) => [table, values.length]));
    if (hash(beforeCounts) !== hash(manifest.expectedBefore)) throw new Error('Starting counts differ from the reviewed baseline');
    const plan = planRows(rows, manifest, before);
    if (!options.commit) {
      await client.query('ROLLBACK');
      return { status: 'dry-run', batchKey: manifest.batchKey, userId: manifest.userId,
        csvSha256: manifest.csvSha256, mappingSha256, before: beforeCounts, ...plan,
        receiptMigrationRequired: !receiptTableExists,
        expectedReadingTotal: before.readings.length + rows.length, conflicts: [],
        verification: 'Checks passed; no writes performed' };
    }
    if (!receiptTableExists) throw new Error('Apply the receipt migration before committing this import');
    const insertedIds = await insertBatch(client, rows, manifest);
    const after = await snapshot(client, manifest.userId);
    const { existing, imported } = partition(after, insertedIds);
    if (hash(existing) !== manifest.baselineSha256) throw new Error('Existing records changed; rolling back');
    for (const table of ['authors', 'books', 'readings'] as const) {
      if (imported[table].length !== manifest.expectedAdditions[table]) throw new Error(`Unexpected ${table} count; rolling back`);
    }
    if (imported.readings.filter((row) => row.date_uncertain).length !== manifest.expectedAdditions.uncertainReadings) {
      throw new Error('Unexpected uncertain reading count; rolling back');
    }
    verifyInsertedValues(rows, manifest, after, insertedIds);
    const insertedSha256 = hash(imported);
    const { rows: [createdReceipt] } = await client.query<{ id: number }>(`INSERT INTO import_receipts
      (batch_key,user_id,csv_sha256,mapping_sha256,inserted_ids,inserted_sha256)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [manifest.batchKey, manifest.userId, manifest.csvSha256, mappingSha256, JSON.stringify(insertedIds), insertedSha256]);
    await client.query('COMMIT');
    return { status: 'imported', receiptId: createdReceipt.id, insertedIds, additions: plan.additions,
      readingTotal: after.readings.length, verification: 'Existing records unchanged; imported counts verified; receipt committed atomically' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
