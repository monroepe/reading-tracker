import { z } from 'zod';
import { readingPeriod } from './reading-period.schema.js';

function isRealDate(v: string) {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isRealDate, 'Invalid date');

const formats = ['Print', 'Kindle', 'Audiobook', 'Graphic Novel'] as const;
const categories = ['Fiction', 'Non-fiction'] as const;

const readingFields = z.object({
  bookId: z.number().int().positive(),
  startedOn: day,
  finishedOn: day.nullable().optional(),
  abandoned: z.boolean().optional(),
  format: z.enum(formats),
  rating: z.number().min(0.5).max(10).multipleOf(0.5).nullable().optional(),
  review: z.string().trim().min(1).nullable().optional(),
  // Reject attempts to set import-only metadata, including false.
  dateUncertain: z.never().optional(),
});

export const readingInput = readingFields
  .refine((v) => !(v.abandoned && v.finishedOn), {
    message: 'An abandoned reading cannot have a finish date',
    path: ['finishedOn'],
  })
  .refine((v) => !v.finishedOn || v.finishedOn >= v.startedOn, {
    message: 'Finish date cannot be before the start date',
    path: ['finishedOn'],
  });

// Cross-field rules need the existing row on update, so the database CHECKs are the backstop there.
export const readingUpdate = readingFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No fields to update');

export const readingSortFields = [
  'title',
  'author',
  'genre',
  'category',
  'pageCount',
  'format',
  'startedOn',
  'finishedOn',
  'days',
  'rating',
] as const;

export const readingListQuery = z.object({
  q: z.string().trim().optional(),
  authorId: z.coerce.number().int().positive().optional(),
  year: readingPeriod.optional(),
  abandoned: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  format: z.enum(formats).optional(),
  genreId: z.coerce.number().int().positive().optional(),
  category: z.enum(categories).optional(),
  sort: z.enum(readingSortFields).default('finishedOn'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(100),
});

export type ReadingInput = z.infer<typeof readingInput>;
export type ReadingUpdate = z.infer<typeof readingUpdate>;
export type ReadingListQuery = z.infer<typeof readingListQuery>;