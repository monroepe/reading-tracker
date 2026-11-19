import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { expect, it, vi } from 'vitest';
import * as schema from './schema.js';
import { migrationPreflight } from './migration-preflight.js';
import * as books from '../books/books.service.js';
import * as tags from '../tags/tags.service.js';
import { getReadingsByTag } from '../analytics/analytics.service.js';
import { getYearInReview } from '../analytics/year-in-review.service.js';
import { listAuthors } from '../authors/authors.service.js';
import { authorList } from '../authors/authors.schemas.js';
import { bookList } from '../books/books.schemas.js';

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('./index.js', () => ({
  db: new Proxy({}, {
    get: (_target, property) => {
      const database = state.db as Record<PropertyKey, unknown>;
      const value = database[property];
      return typeof value === 'function' ? value.bind(database) : value;
    },
  }),
}));

// Explicit opt-in only. Never load or use the application's DATABASE_URL here.
it.skipIf(!process.env.TEST_DATABASE_URL)('preserves legacy data and enforces personal tags on PostgreSQL', async () => {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) throw new Error('Use a separate, empty disposable database');
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  const rolledBack = new Error('Rollback integration fixtures');
  try {
    const occupied = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    if (occupied.rowCount) throw new Error('TEST_DATABASE_URL must point to an empty disposable database');
    const database = drizzle(client, { schema });
    await expect(database.transaction(async (tx) => {
      state.db = tx;
      const migration = async (file: string) => {
        const sql = await readFile(fileURLToPath(new URL(`../../drizzle/${file}`, import.meta.url)), 'utf8');
        await client.query(sql);
      };
      await migration('0000_melodic_gorilla_man.sql');
      await migration('0001_outgoing_wild_child.sql');
      await migration('0002_dazzling_lockjaw.sql');
      await client.query(`INSERT INTO users (email, password_hash) VALUES ('test@example.test', 'hash'), ('owner@example.test', 'hash');
        INSERT INTO authors (first_name, last_name) VALUES ('John', 'Smith');
        INSERT INTO genres (name) VALUES ('Fantasy');
        INSERT INTO books (title, author_id, genre_id, category, page_count) VALUES ('The Hobbit', 1, 1, 'Fiction', 310);
        INSERT INTO tags (name) VALUES ('Fun');
        INSERT INTO book_tags (book_id, tag_id) VALUES (1, 1);
        INSERT INTO readings (user_id, book_id, started_on, finished_on, format) VALUES (2, 1, '2024-12-20', '2025-01-01', 'Print');`);
      const before = await migrationPreflight(client, 'owner@example.test');
      expect(before.violations).toEqual([]);
      await client.query('SAVEPOINT missing_owner');
      await expect(migration('0003_personal_tags_and_author_names.sql')).rejects.toMatchObject({ code: 'P0001' });
      await client.query('ROLLBACK TO SAVEPOINT missing_owner');
      await client.query('RELEASE SAVEPOINT missing_owner');
      expect((await client.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'created_by_user_id'")).rows[0].count).toBe(0);
      await client.query("SELECT set_config('reading_tracker.owner_email', 'owner@example.test', true)");
      await migration('0003_personal_tags_and_author_names.sql');
      // Service calls below use the current Drizzle schema.
      const journal = JSON.parse(await readFile(fileURLToPath(new URL('../../drizzle/meta/_journal.json', import.meta.url)), 'utf8'));
      for (const entry of journal.entries) {
        if (entry.idx > 3) await migration(`${entry.tag}.sql`);
      }
      expect((await migrationPreflight(client, 'owner@example.test')).counts).toEqual(before.counts);
      expect((await client.query('SELECT role FROM users WHERE id = 2')).rows[0].role).toBe('admin');
      expect((await client.query('SELECT role FROM users WHERE id = 1')).rows[0].role).toBe('user');
      expect((await client.query('SELECT middle_name FROM authors WHERE id = 1')).rows[0].middle_name).toBe('');
      expect((await client.query('SELECT created_by_user_id FROM tags')).rows[0].created_by_user_id).toBe(2);
      expect((await books.getBook(2, 1)).tags).toEqual([{ id: 1, name: 'Fun' }]);
      expect((await books.getBook(1, 1)).tags).toEqual([]);

      // Reuse preserves creator and ID, including case-insensitive names.
      expect(await tags.createTag(1, { name: 'fun' })).toEqual({ tag: { id: 1, name: 'Fun' }, created: false });
      const { tag: favorite } = await tags.createTag(1, { name: 'Favorite' });
      expect((await client.query('SELECT created_by_user_id FROM tags WHERE id = $1', [favorite.id])).rows[0].created_by_user_id).toBe(1);
      await books.replaceBookTags(1, 1, [favorite.id]);
      expect((await books.getBook(2, 1)).tags).toEqual([{ id: 1, name: 'Fun' }]);
      expect((await books.listBooks(1, bookList.parse({ tagIds: [1] }))).total).toBe(0);
      expect((await books.listBooks(2, bookList.parse({ tagIds: [1] }))).total).toBe(1);
      await books.updateBook(2, 1, { tagIds: [] });
      expect((await books.getBook(1, 1)).tags).toEqual([favorite]);
      await books.updateBook(2, 1, { tagIds: [1] });
      const newBook = await books.createBook(2, { title: 'Second book', authorId: 1, genreId: 1, category: 'Fiction', pageCount: 100, tagIds: [1] });
      expect(newBook.tags).toEqual([{ id: 1, name: 'Fun' }]);
      expect((await books.getBook(1, newBook.id)).tags).toEqual([]);
      await books.deleteBook(newBook.id);

      // A failed replacement must restore the previous assignments.
      await expect(books.replaceBookTags(1, 1, [99999])).rejects.toBeDefined();
      expect((await books.getBook(1, 1)).tags).toEqual([favorite]);
      await expect(books.replaceBookTags(1, 99999, [])).rejects.toMatchObject({ status: 404 });
      await books.replaceBookTags(1, 1, []);
      expect((await books.getBook(1, 1)).tags).toEqual([]);
      await books.replaceBookTags(1, 1, [favorite.id]);

      await client.query(`INSERT INTO readings (user_id, book_id, started_on, finished_on, abandoned, format) VALUES
        (2, 1, '2025-01-02', '2025-02-01', false, 'Audiobook'),
        (2, 1, '2025-12-31', '2026-01-01', false, 'Print'),
        (2, 1, '2025-01-01', NULL, false, 'Print'),
        (2, 1, '2025-01-01', NULL, true, 'Print'),
        (1, 1, '2025-01-01', '2025-03-01', false, 'Print');`);
      expect(await getReadingsByTag(2, 2025)).toEqual([{ tag: 'Fun', count: 2 }]);
      expect(await getReadingsByTag(2, 2024)).toEqual([]);
      expect(await getReadingsByTag(2)).toEqual([{ tag: 'Fun', count: 3 }]);
      expect(await getReadingsByTag(1, 2025)).toEqual([{ tag: 'Favorite', count: 1 }]);
      const review = await getYearInReview(2, { year: 2025, includeGraphicNovelsInBooks: false, includeGraphicNovelsInAuthors: false });
      expect(review.byTag).toEqual([{ tag: 'Fun', count: 2 }]);
      expect((await tags.listAdminTags({ page: 1, pageSize: 50 })).data.find((tag) => tag.id === 1)?.assignmentCount).toBe(1);

      // Each expected database error is isolated so the enclosing fixture transaction survives.
      const rejectSql = async (sql: string, code: string) => {
        await client.query('SAVEPOINT expected_failure');
        await expect(client.query(sql)).rejects.toMatchObject({ code });
        await client.query('ROLLBACK TO SAVEPOINT expected_failure');
        await client.query('RELEASE SAVEPOINT expected_failure');
      };
      await rejectSql("INSERT INTO tags (name, created_by_user_id) VALUES ('FUN', 2)", '23505');
      await rejectSql("UPDATE tags SET name = 'Fun' WHERE name = 'Favorite'", '23505');
      await rejectSql("INSERT INTO authors (first_name, middle_name, last_name) VALUES ('JOHN', '', 'SMITH')", '23505');
      await client.query("INSERT INTO authors (first_name, middle_name, last_name) VALUES ('John', 'A.', 'Smith')");
      expect((await listAuthors(authorList.parse({ q: 'John A. Smith' }))).total).toBe(1);
      expect((await listAuthors(authorList.parse({ q: 'John Smith' }))).total).toBe(2);
      for (const sql of [
        "UPDATE books SET page_count = 0", "UPDATE books SET page_count = -1", "UPDATE books SET title = E' \\t '",
        "UPDATE books SET category = 'Poetry'", "UPDATE authors SET last_name = ' '", "UPDATE authors SET gender = 'Unknown'",
        "UPDATE genres SET name = ' '", "UPDATE tags SET name = ' '", "UPDATE readings SET format = 'Other'", "UPDATE users SET role = 'superuser'",
      ]) await rejectSql(sql, '23514');
      await client.query("UPDATE authors SET first_name = '', middle_name = '', gender = NULL WHERE id = 1");
      await books.replaceBookTags(1, 1, [1, favorite.id]);
      await tags.deleteTag(1);
      expect((await books.getBook(2, 1)).tags).toEqual([]);
      expect((await books.getBook(1, 1)).tags).toEqual([favorite]);
      expect((await getReadingsByTag(2, 2025))).toEqual([]);
      expect((await migrationPreflight(client)).counts).toMatchObject({ books: 1, readings: 6 });
      throw rolledBack;
    })).rejects.toBe(rolledBack);
    expect((await client.query("SELECT to_regclass('public.books') AS books")).rows[0].books).toBeNull();
  } finally { await client.end(); }
}, 30000);
