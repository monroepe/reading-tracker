import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { expect, it } from 'vitest';

it.skipIf(!process.env.TEST_DATABASE_URL)('preserves data and tracks atomic changes with stable identities', async () => {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) throw new Error('Use a disposable test database');
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    if ((await client.query("SELECT 1 FROM pg_tables WHERE schemaname = 'public'")).rowCount) throw new Error('Test database must be empty');
    await client.query('BEGIN');
    const journal = JSON.parse(await readFile(fileURLToPath(new URL('../../drizzle/meta/_journal.json', import.meta.url)), 'utf8'));
    for (const entry of journal.entries) {
      if (entry.idx === 6) {
        await client.query(`INSERT INTO users(email,password_hash) VALUES ('test@example.test','secret');
          INSERT INTO authors(last_name) VALUES ('Author');
          INSERT INTO genres(name) VALUES ('Fantasy');
          INSERT INTO books(title,author_id,genre_id,category,page_count) VALUES ('Book',1,1,'Fiction',100);
          INSERT INTO tags(name,created_by_user_id) VALUES ('Favorite',1);
          INSERT INTO book_tags VALUES (1,1,1);`);
      }
      await client.query(await readFile(fileURLToPath(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url)), 'utf8'));
    }
    const original = (await client.query('SELECT * FROM books')).rows[0];
    expect(original).toMatchObject({ id: 1, title: 'Book', page_count: 100 });
    expect(original.sync_id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await client.query('SELECT * FROM transfer_changes')).rowCount).toBe(0);
    await client.query("UPDATE books SET title = 'Corrected' WHERE id = 1");
    const change = (await client.query('SELECT * FROM transfer_changes')).rows[0];
    expect(change.before_state.fields.title).toBe('Book');
    expect(change.after_state.fields.title).toBe('Corrected');
    expect(change.after_state.fields.authorId).toMatch(/^[0-9a-f-]{36}$/);
    await client.query("UPDATE books SET title = 'Corrected' WHERE id = 1");
    expect((await client.query('SELECT * FROM transfer_changes')).rowCount).toBe(1);
    await client.query('SAVEPOINT failed_save');
    await client.query("UPDATE books SET title = 'Rollback' WHERE id = 1");
    await client.query('ROLLBACK TO SAVEPOINT failed_save');
    expect((await client.query('SELECT * FROM transfer_changes')).rowCount).toBe(1);
    await client.query('DELETE FROM book_tags');
    await client.query('INSERT INTO book_tags VALUES (1,1,1)');
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    expect((await client.query('SELECT * FROM transfer_changes')).rowCount).toBe(1);
    await client.query('DELETE FROM books WHERE id = 1');
    expect((await client.query("SELECT state FROM transfer_states WHERE entity_type IN ('books','bookTags')")).rows.every(r => r.state === null)).toBe(true);
    expect(JSON.stringify((await client.query('SELECT * FROM transfer_states')).rows)).not.toContain('secret');

    // Identity changes must fail without poisoning the surrounding test transaction.
    for (const statement of [
      'UPDATE authors SET sync_id = gen_random_uuid()',
      'UPDATE users SET library_id = gen_random_uuid()',
    ]) {
      await client.query('SAVEPOINT identity_change');
      await expect(client.query(statement)).rejects.toThrow(/immutable/);
      await client.query('ROLLBACK TO SAVEPOINT identity_change');
    }

    await client.query(`INSERT INTO users(email,password_hash) VALUES ('other@example.test','private');
      INSERT INTO books(id,title,author_id,genre_id,category,page_count) OVERRIDING SYSTEM VALUE VALUES (2,'New book',1,1,'Fiction',100);
      INSERT INTO readings(user_id,book_id,started_on,format) VALUES
        (1,2,'2026-01-01','Print'), (2,2,'2026-02-01','Kindle');
      INSERT INTO book_tags(user_id,book_id,tag_id) VALUES (1,2,1), (2,2,1)`);
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    const readingStates = (await client.query(`SELECT s.library_id, s.state, u.library_id AS expected_owner
      FROM readings r JOIN users u ON u.id = r.user_id
      JOIN transfer_states s ON s.entity_type = 'readings' AND s.entity_id = r.sync_id`)).rows;
    expect(readingStates).toHaveLength(2);
    for (const state of readingStates) {
      expect(state.library_id).toBe(state.expected_owner);
      expect(state.state.fields.bookId).toMatch(/^[0-9a-f-]{36}$/);
      expect(state.state.fields).not.toHaveProperty('user_id');
    }
    expect(new Set(readingStates.map(row => row.library_id)).size).toBe(2);

    // A shared tag deletion changes both owners' selections, not their readings.
    const beforeReadings = JSON.stringify(readingStates);
    await client.query('DELETE FROM tags WHERE id = 1');
    const selections = (await client.query(`SELECT library_id, state FROM transfer_states
      WHERE entity_type = 'bookTags' AND state IS NOT NULL`)).rows;
    expect(selections).toHaveLength(2);
    expect(new Set(selections.map(row => row.library_id)).size).toBe(2);
    for (const selection of selections) expect(selection.state.tagIds).toEqual([]);
    const afterReadings = (await client.query(`SELECT s.library_id, s.state, u.library_id AS expected_owner
      FROM readings r JOIN users u ON u.id = r.user_id
      JOIN transfer_states s ON s.entity_type = 'readings' AND s.entity_id = r.sync_id`)).rows;
    expect(JSON.stringify(afterReadings)).toBe(beforeReadings);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}, 30000);
