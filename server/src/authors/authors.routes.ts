import { Router } from 'express';
import { currentUserId, requireAdmin } from '../middleware/auth.js';
import { idParam } from '../shared/schemas.js';
import { authorInput, authorList, authorUpdate } from './authors.schemas.js';
import * as service from './authors.service.js';

export const authorsRouter = Router();

authorsRouter.get('/', async (req, res) => {
  res.json(await service.listAuthors(authorList.parse(req.query)));
});

// Must stay above '/:id' or "countries" is parsed as an id.
authorsRouter.get('/countries', async (_req, res) => {
  res.json(await service.listAuthorCountries());
});

authorsRouter.get('/:id', async (req, res) => {
  res.json(await service.getAuthor(idParam.parse(req.params.id)));
});

authorsRouter.get('/:id/books', async (req, res) => {
  res.json(await service.listAuthorBooks(currentUserId(req), idParam.parse(req.params.id)));
});

authorsRouter.post('/', async (req, res) => {
  const created = await service.createAuthor(authorInput.parse(req.body));
  res.status(201).json(created);
});

authorsRouter.patch('/:id', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await service.updateAuthor(id, authorUpdate.parse(req.body)));
});

authorsRouter.delete('/:id', requireAdmin, async (req, res) => {
  await service.deleteAuthor(idParam.parse(req.params.id));
  res.status(204).end();
});