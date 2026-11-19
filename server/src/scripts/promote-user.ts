import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';

async function main() {
  const email = process.argv[2]?.trim();
  if (!email || process.argv.length !== 3) throw new Error('Usage: npm run promote-user -- <email>');
  const [user] = await db.update(users).set({ role: 'admin' })
    .where(eq(sql`lower(${users.email})`, email.toLowerCase())).returning({ id: users.id });
  if (!user) throw new Error('No account with that email exists');
  console.log(`Promoted account ${user.id} to admin`);
}

main().catch((err: Error) => { console.error(err.message); process.exitCode = 1; }).finally(() => pool.end());
