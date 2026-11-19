import { z } from 'zod';

const id = z.number().int().positive();
const CATEGORIES = ['Fiction', 'Non-fiction'] as const;

export const bookInput = z.object({
  title: z.string().trim().min(1),
  authorId: id,
  coAuthors: z.string().trim().min(1).nullable().optional(),
  genreId: id,
  category: z.enum(CATEGORIES),
  pageCount: id,
  tagIds: z.array(id).transform((ids) => [...new Set(ids)]).optional(),
});

export const bookUpdate = bookInput
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No fields to update');

export const bookSortFields = [
  'title',
  'author',
  'genre',
  'category',
  'pageCount',
  'rating',
] as const;

export const bookList = z.object({
  q: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  authorId: z.coerce.number().int().positive().optional(),
  genreId: z.coerce.number().int().positive().optional(),
  category: z.enum(CATEGORIES).optional(),
  tagIds: z.array(z.coerce.number().int().positive()).optional(),
  sort: z.enum(bookSortFields).default('title'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(25),
});

export type BookInput = z.infer<typeof bookInput>;
export type BookUpdate = z.infer<typeof bookUpdate>;
export type BookListQuery = z.infer<typeof bookList>;
export const bookTagInput = z.object({ tagIds: z.array(id).transform((ids) => [...new Set(ids)]) }).strict();
