import { z } from 'zod';
import { readingPeriod } from '../readings/reading-period.js';

export const analyticsQuery = z.object({
    year: readingPeriod.optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuery>;

export const readingsByYearQuery = z.object({
    format: z.enum(['Print', 'Kindle', 'Audiobook', 'Graphic Novel']).optional(),
    genreId: z.coerce.number().int().positive().optional(),
    category: z.enum(['Fiction', 'Non-fiction']).optional(),
});

export type ReadingsByYearQuery = z.infer<typeof readingsByYearQuery>;

export const topAuthorsQuery = z.object({
    sort: z.enum(['books', 'rating']).default('books'),
    includeGraphicNovels: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});

export type TopAuthorsQuery = z.infer<typeof topAuthorsQuery>;

const inclusionOption = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

export const topBooksQuery = z.object({
    tagId: z.coerce.number().int().positive().optional(),
    genreId: z.coerce.number().int().positive().optional(),
    includeGraphicNovels: inclusionOption,
}).refine((query) => query.tagId !== undefined || query.genreId !== undefined, {
    message: 'Select a tag or genre.',
});

export type TopBooksQuery = z.infer<typeof topBooksQuery>;

export const yearInReviewQuery = z.object({
    year: readingPeriod,
    includeGraphicNovelsInBooks: inclusionOption,
    includeGraphicNovelsInAuthors: inclusionOption,
});

export type YearInReviewQuery = z.infer<typeof yearInReviewQuery>;
