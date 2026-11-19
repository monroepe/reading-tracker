import { z } from 'zod';

const GENDERS = ['Female', 'Male', 'Non-binary'] as const;

// No .default() calls: the database supplies defaults on create,
// and PATCH (partial) must not overwrite fields that weren't sent.
export const authorInput = z.object({
  middleName: z.string().trim().optional(),
  firstName: z.string().trim().optional(), // empty for mononyms; the database defaults it to ''
  lastName: z.string().trim().min(1),
  countryIds: z.array(z.number().int().positive()).refine(ids => new Set(ids).size === ids.length, 'Duplicate countries').optional(),
  gender: z.enum(GENDERS).nullable().optional(),
});

export const authorUpdate = authorInput
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'No fields to update');

export const authorSortFields = ['name', 'firstName', 'country', 'gender', 'bookCount'] as const;

// Defaults are fine here: this validates query params, not stored data.
export const authorList = z.object({
  q: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  gender: z.enum(GENDERS).optional(),
  sort: z.enum(authorSortFields).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(25), // raise cap until the UI paginates
});

export type AuthorInput = z.infer<typeof authorInput>;
export type AuthorUpdate = z.infer<typeof authorUpdate>;
export type AuthorListQuery = z.infer<typeof authorList>;