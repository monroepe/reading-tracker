import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { expect, it } from 'vitest';

it.skipIf(!process.env.TEST_DATABASE_URL)('serializes competing tag replacements and journals each committed selection', async () => {
  const target = new URL(process.env.TEST_DATABASE_URL!);
  if (process.env.DATABASE_URL) {
    const real = new URL(process.env.DATABASE_URL);
    if (target.hostname === real.hostname && target.port === real.port && target.pathname === real.pathname) {
      throw new Error('Use a disposable test database');
    }
  }
  // Committed fixtures are needed across connections. A separate generated database
  // keeps them isolated from integration tests that roll their migrations back.
  const database = `reading_tracker_concurrency_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: target.toString() });
  const clients: pg.Client[] = [];
  let created = false;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    target.pathname = `/${database}`;
    for (let i = 0; i < 3; i++) {
      const client = new pg.Client({ connectionString: target.toString() });
      clients.push(client);
      await client.connect();
      await client.query("SET statement_timeout = '5s'");
    }
    const [observer, first, second] = clients;
    const journal = JSON.parse(await readFile(fileURLToPath(new URL('../../drizzle/meta/_journal.json', import.meta.url)), 'utf8'));
    for (const entry of journal.entries) {
      await observer.query(await readFile(fileURLToPath(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url)), 'utf8'));
    }
    await observer.query(`INSERT INTO users(email,password_hash) VALUES ('test@example.test','fixture');
      INSERT INTO authors(last_name) VALUES ('Author');
      INSERT INTO genres(name) VALUES ('Fantasy');
      INSERT INTO books(title,author_id,genre_id,category,page_count) VALUES ('Book',1,1,'Fiction',100);
      INSERT INTO tags(name,created_by_user_id) VALUES ('Original',1), ('First',1), ('Second',1);
      INSERT INTO book_tags(user_id,book_id,tag_id) VALUES (1,1,1)`);
    const baseline = (await observer.query("SELECT * FROM transfer_states WHERE entity_type = 'bookTags'")).rows[0];
    const tagRows = (await observer.query('SELECT id, sync_id FROM tags ORDER BY id')).rows;
    const pid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const firstPid = (await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await first.query('BEGIN');
    await second.query('BEGIN');
    // Follow replaceBookTags: acquire the book lock before deleting any assignments.
    await first.query('SELECT id FROM books WHERE id = 1 FOR UPDATE');
    await first.query('DELETE FROM book_tags WHERE user_id = 1 AND book_id = 1');
    await first.query('INSERT INTO book_tags(user_id,book_id,tag_id) VALUES (1,1,2)');
    const waiting = second.query('SELECT id FROM books WHERE id = 1 FOR UPDATE');
    // Attach a rejection handler immediately, including on failed assertions below.
    const lockResult = waiting.then(() => null, error => error as Error);
    const deadline = Date.now() + 3000;
    let blocked = false;
    while (Date.now() < deadline) {
      const result = await observer.query('SELECT $1::int = ANY(pg_blocking_pids($2)) AS blocked', [firstPid, pid]);
      if (result.rows[0].blocked) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
    expect((await observer.query("SELECT revision FROM transfer_states WHERE entity_type = 'bookTags'")).rows[0].revision).toBe(baseline.revision);
    await first.query('COMMIT');
    expect(await lockResult).toBeNull();
    const intermediate = (await observer.query("SELECT * FROM transfer_states WHERE entity_type = 'bookTags'")).rows[0];
    expect(intermediate.state.tagIds).toEqual([tagRows[1].sync_id]);
    await second.query('DELETE FROM book_tags WHERE user_id = 1 AND book_id = 1');
    await second.query('INSERT INTO book_tags(user_id,book_id,tag_id) VALUES (1,1,3)');
    await second.query('COMMIT');
    expect((await observer.query('SELECT tag_id FROM book_tags')).rows).toEqual([{ tag_id: 3 }]);
    const final = (await observer.query("SELECT * FROM transfer_states WHERE entity_type = 'bookTags'")).rows[0];
    expect(final.state.tagIds).toEqual([tagRows[2].sync_id]);
    const changes = (await observer.query("SELECT * FROM transfer_changes WHERE entity_type = 'bookTags' AND previous_revision IS NOT NULL")).rows;
    expect(changes).toHaveLength(2);
    expect(changes.find(row => row.previous_revision === baseline.revision)).toMatchObject({
      revision: intermediate.revision, before_state: baseline.state, after_state: intermediate.state,
    });
    expect(changes.find(row => row.previous_revision === intermediate.revision)).toMatchObject({
      revision: final.revision, before_state: intermediate.state, after_state: final.state,
    });
  } finally {
    // End both writers together so a pending lock cannot hold cleanup hostage.
    await Promise.allSettled(clients.map(client => client.end()));
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}, 30000);
