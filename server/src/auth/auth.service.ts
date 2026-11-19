import { hash, verify } from '@node-rs/argon2';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';

// Verified against when the email is unknown, so response time doesn't reveal which emails exist.
const dummyHash = await hash('not-a-real-password');

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  const valid = await verify(user?.passwordHash ?? dummyHash, password);
  if (!user || !valid) throw new HttpError(401, 'Invalid email or password');
  return { id: user.id, email: user.email, role: user.role };
}

export async function getUser(id: number) {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id));
  if (!user) throw new HttpError(401, 'Not authenticated');
  return user;
}
