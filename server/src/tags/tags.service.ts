import { asc, count, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookTags, tags } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';
import type { TagInput, TagSearch } from './tags.schemas.js';

const tagSelect = { id: tags.id, name: tags.name };

export async function listTags({ q, page, pageSize }: TagSearch) {
  const escaped = q?.replace(/[\\%_]/g, '\\$&');
  const where = q ? ilike(tags.name, `%${escaped}%`) : undefined;
  const [data, [{ total }]] = await Promise.all([
    db.select(tagSelect).from(tags).where(where).orderBy(asc(tags.name), asc(tags.id))
      .limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(tags).where(where),
  ]);
  return { data, total, page, pageSize };
}

export async function listAdminTags({ q, page, pageSize }: TagSearch) {
  const escaped = q?.replace(/[\\%_]/g, '\\$&');
  const where = q ? ilike(tags.name, `%${escaped}%`) : undefined;
  const [data, [{ total }]] = await Promise.all([
    db.select({ ...tagSelect, assignmentCount: count(bookTags.tagId) }).from(tags)
      .leftJoin(bookTags, eq(tags.id, bookTags.tagId)).where(where)
      .groupBy(tags.id).orderBy(asc(tags.name), asc(tags.id))
      .limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: count() }).from(tags).where(where),
  ]);
  return { data, total, page, pageSize };
}

export async function getTag(id: number) {
  const [row] = await db.select(tagSelect).from(tags).where(eq(tags.id, id));
  if (!row) throw new HttpError(404, 'Tag not found');
  return row;
}

export async function createTag(userId: number, input: TagInput) {
  // The unique expression index arbitrates concurrent creates. Never replace its creator.
  const [created] = await db.insert(tags).values({ ...input, createdByUserId: userId })
    .onConflictDoNothing().returning(tagSelect);
  if (created) return { tag: created, created: true };
  const [existing] = await db.select(tagSelect).from(tags)
    .where(sql`lower(${tags.name}) = lower(${input.name})`);
  if (!existing) throw new HttpError(409, 'Tag changed while saving; please retry');
  return { tag: existing, created: false };
}

export async function updateTag(id: number, input: TagInput) {
  const [updated] = await db.update(tags).set(input).where(eq(tags.id, id)).returning(tagSelect);
  if (!updated) throw new HttpError(404, 'Tag not found');
  return updated;
}

export async function deleteTag(id: number) {
  // ON DELETE CASCADE removes all personal assignments in the same statement.
  const [deleted] = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  if (!deleted) throw new HttpError(404, 'Tag not found');
}
