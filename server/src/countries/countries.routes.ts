import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { countries } from '../db/schema.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { idParam } from '../shared/schemas.js';
export const countriesRouter = Router();
const input = z.object({ name: z.string().trim().min(1) });
countriesRouter.get('/', async (_req, res) => { res.json(await db.select({ id: countries.id, name: countries.name }).from(countries).orderBy(asc(countries.name))); });
countriesRouter.post('/', requireAdmin, async (req, res) => {
  const [row] = await db.insert(countries).values(input.parse(req.body)).returning({ id: countries.id, name: countries.name });
  res.status(201).json(row);
});
countriesRouter.patch('/:id', requireAdmin, async (req, res) => {
  const [row] = await db.update(countries).set(input.parse(req.body)).where(eq(countries.id, idParam.parse(req.params.id))).returning({ id: countries.id, name: countries.name });
  if (!row) throw new HttpError(404, 'Country not found');
  res.json(row);
});
