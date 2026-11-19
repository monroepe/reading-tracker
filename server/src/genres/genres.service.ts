import { asc, eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { genres } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';
import type { GenreInput } from './genres.schemas.js';

export function listGenres(q?: string) {
  return db
    .select({ id: genres.id, name: genres.name })
    .from(genres)
    .where(q ? ilike(genres.name, `%${q}%`) : undefined)
    .orderBy(asc(genres.name));
}

export async function getGenre(id: number) {
  const [row] = await db.select({ id: genres.id, name: genres.name }).from(genres).where(eq(genres.id, id));
  if (!row) throw new HttpError(404, 'Genre not found');
  return row;
}

export async function createGenre(input: GenreInput) {
  const [created] = await db.insert(genres).values(input).returning({ id: genres.id, name: genres.name });
  return created;
}

export async function updateGenre(id: number, input: GenreInput) {
  const [updated] = await db.update(genres).set(input).where(eq(genres.id, id)).returning({ id: genres.id, name: genres.name });
  if (!updated) throw new HttpError(404, 'Genre not found');
  return updated;
}

export async function deleteGenre(id: number) {
  const [deleted] = await db.delete(genres).where(eq(genres.id, id)).returning({ id: genres.id, name: genres.name });
  if (!deleted) throw new HttpError(404, 'Genre not found');
}
