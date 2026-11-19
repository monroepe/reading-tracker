import { z } from 'zod';

export const genreInput = z.object({ name: z.string().trim().min(1) });
export const genreSearch = z.object({ q: z.string().trim().optional() });

export type GenreInput = z.infer<typeof genreInput>;
