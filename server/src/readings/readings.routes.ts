import { exportFilename } from '../shared/export-filename.js';
import { z } from 'zod';
import { exportReadings } from './readings-export.js';
import { Router } from 'express';
import { currentUserId } from '../middleware/auth.js';
import { idParam } from '../shared/schemas.js';
import { readingInput, readingListQuery, readingUpdate } from './readings.schemas.js';
import * as service from './readings.service.js';

export const readingsRouter = Router();

readingsRouter.get('/', async (req, res) => {
  res.json(await service.listReadings(currentUserId(req), readingListQuery.parse(req.query)));
});

readingsRouter.get('/export.csv', async (req, res) => {
  const format = z.enum(['legacy', 'expanded']).parse(req.query.format);
  const filename = exportFilename(`readings-${format}`, new Date().toISOString(), 'csv');
  res.set('Cache-Control', 'private, no-store').attachment(filename).type('text/csv').send(await exportReadings(currentUserId(req), format === 'expanded'));
});

readingsRouter.get('/:id', async (req, res) => {
  res.json(await service.getReading(currentUserId(req), idParam.parse(req.params.id)));
});

readingsRouter.post('/', async (req, res) => {
  const created = await service.createReading(currentUserId(req), readingInput.parse(req.body));
  res.status(201).json(created);
});

readingsRouter.patch('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await service.updateReading(currentUserId(req), id, readingUpdate.parse(req.body)));
});

readingsRouter.delete('/:id', async (req, res) => {
  await service.deleteReading(currentUserId(req), idParam.parse(req.params.id));
  res.status(204).end();
});