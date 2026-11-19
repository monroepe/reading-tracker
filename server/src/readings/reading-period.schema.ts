import { z } from 'zod';
export const readingPeriod = z.union([z.literal('pre-2022'), z.coerce.number().int().min(1900).max(2100)]);
export type ReadingPeriod = z.infer<typeof readingPeriod>;

