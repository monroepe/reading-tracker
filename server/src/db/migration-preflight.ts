import type pg from 'pg';

// These queries deliberately use the legacy columns so they work before migration 0003.
export async function migrationPreflight(client: pg.Client, ownerEmail?: string) {
  const { rows: [{ present }] } = await client.query("SELECT to_regclass('public.users') IS NOT NULL AS present");
  if (!present) {
    if (ownerEmail) throw new Error('Create the owner account after initializing this empty database; omit --owner-email for its initial migration');
    return { counts: null, violations: [] };
  }
  if (ownerEmail) {
    const owner = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [ownerEmail]);
    if (owner.rowCount !== 1) throw new Error('Owner email must identify exactly one existing account');
  }
  const { rows: [counts] } = await client.query(`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM session) AS sessions,
    (SELECT count(*)::int FROM authors) AS authors,
    (SELECT count(*)::int FROM books) AS books,
    (SELECT count(*)::int FROM readings) AS readings,
    (SELECT count(*)::int FROM genres) AS genres,
    (SELECT count(*)::int FROM tags) AS tags,
    (SELECT count(*)::int FROM book_tags) AS assignments`);
  const { rows: violations } = await client.query<{ table: string; id: number; rule: string }>(`
    SELECT 'authors' AS "table", id, 'nonblank last name' AS rule FROM authors WHERE NOT (last_name ~ '[^[:space:]]')
    UNION ALL SELECT 'authors', id, 'allowed gender' FROM authors WHERE gender NOT IN ('Female', 'Male', 'Non-binary')
    UNION ALL SELECT 'books', id, 'nonblank title' FROM books WHERE NOT (title ~ '[^[:space:]]')
    UNION ALL SELECT 'books', id, 'positive page count' FROM books WHERE page_count IS NULL OR page_count <= 0
    UNION ALL SELECT 'books', id, 'allowed category' FROM books WHERE category NOT IN ('Fiction', 'Non-fiction')
    UNION ALL SELECT 'genres', id, 'nonblank name' FROM genres WHERE NOT (name ~ '[^[:space:]]')
    UNION ALL SELECT 'tags', id, 'nonblank name' FROM tags WHERE NOT (name ~ '[^[:space:]]')
    UNION ALL SELECT 'readings', id, 'allowed format' FROM readings WHERE format NOT IN ('Print', 'Kindle', 'Audiobook', 'Graphic Novel')
  `);
  return { counts, violations };
}
