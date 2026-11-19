import { requireAdmin } from '../middleware/auth.js';
import { Router } from 'express';
import { idParam } from '../shared/schemas.js';
import { genreInput, genreSearch } from './genres.schemas.js';
import * as service from './genres.service.js';

export const genresRouter = Router();

genresRouter.get('/', async (req, res) => {
  const { q } = genreSearch.parse(req.query);
  res.json(await service.listGenres(q));
});

genresRouter.get('/:id', async (req, res) => {
  res.json(await service.getGenre(idParam.parse(req.params.id)));
});

genresRouter.post('/', requireAdmin, async (req, res) => {
  const created = await service.createGenre(genreInput.parse(req.body));
  res.status(201).json(created);
});

genresRouter.patch('/:id', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await service.updateGenre(id, genreInput.parse(req.body)));
});

genresRouter.delete('/:id', requireAdmin, async (req, res) => {
  await service.deleteGenre(idParam.parse(req.params.id));
  res.status(204).end();
});
