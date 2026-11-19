import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { migrationPreflight } from '../db/migration-preflight.js';

async function main() {
  const args = process.argv.slice(2);
  let ownerEmail: string | undefined;
  let checkOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') checkOnly = true;
    else if (args[i] === '--owner-email' && args[i + 1] && !args[i + 1].startsWith('--')) ownerEmail = args[++i].trim();
    else throw new Error('Usage: npm run db:migrate -- [--check] [--owner-email <email>]');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const before = await migrationPreflight(client, ownerEmail);
    console.log('Before migration:', before.counts ?? 'Empty database');
    if (before.violations.length) {
      console.table(before.violations);
      throw new Error('Correct the listed records before migrating; no data has been changed');
    }
    // Require ownership only while the legacy tag schema is present.
    const { rows: [{ legacy }] } = await client.query(`SELECT
      to_regclass('public.tags') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tags' AND column_name = 'created_by_user_id'
      ) AS legacy`);
    if (legacy && !ownerEmail && (before.counts?.tags || before.counts?.assignments)) {
      throw new Error('Specify --owner-email to preserve existing tags and assignments as yours');
    }
    if (checkOnly) { console.log('Preflight passed. No changes made.'); return; }
    // A dedicated connection keeps the explicit owner available throughout Drizzle's transaction.
    await client.query("SELECT set_config('reading_tracker.owner_email', $1, false)", [ownerEmail ?? '']);
    await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
    const after = await migrationPreflight(client, ownerEmail);
    console.log('After migration:', after.counts);
    if (before.counts && JSON.stringify(before.counts) !== JSON.stringify(after.counts)) {
      throw new Error('Migration committed, but record counts differ. Keep the app stopped and investigate using the backup.');
    }
    console.log('Migration complete. Existing records preserved.');
  } finally { await client.end(); }
}

main().catch((err: Error) => { console.error(err.message); process.exitCode = 1; });
