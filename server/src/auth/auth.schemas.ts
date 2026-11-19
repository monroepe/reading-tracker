import { z } from 'zod';

export const loginInput = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});
