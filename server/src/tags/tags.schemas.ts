import { z } from 'zod';

export const tagInput = z.object({ name: z.string().trim().min(1) });
export const tagSearch = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type TagSearch = z.infer<typeof tagSearch>;

export type TagInput = z.infer<typeof tagInput>;
