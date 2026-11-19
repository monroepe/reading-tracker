import { Router } from 'express';

import { currentUserId, requireAdmin } from '../middleware/auth.js';
import { idParam } from '../shared/schemas.js';
import { bookInput, bookList, bookUpdate, bookTagInput } from './books.schemas.js';
import * as service from './books.service.js';

export const booksRouter = Router();

booksRouter.get('/', async (req, res) => {
  const rawTagIds = req.query.tagIds;

  const query = {
    ...req.query,
    tagIds:
      rawTagIds === undefined
        ? undefined
        : (Array.isArray(rawTagIds) ? rawTagIds : [rawTagIds]).flatMap((value) =>
          String(value).split(','),
        ),
  };

  res.json(await service.listBooks(currentUserId(req), bookList.parse(query)));
});

booksRouter.get('/:id', async (req, res) => {
  res.json(await service.getBook(currentUserId(req), idParam.parse(req.params.id)));
});

booksRouter.get('/:id/readings', async (req, res) => {
  res.json(await service.listBookReadings(currentUserId(req), idParam.parse(req.params.id)));
});

booksRouter.post('/', async (req, res) => {
  const created = await service.createBook(currentUserId(req), bookInput.parse(req.body));

  res.status(201).json(created);
});

booksRouter.patch('/:id', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);

  res.json(await service.updateBook(currentUserId(req), id, bookUpdate.parse(req.body)));
});

booksRouter.delete('/:id', requireAdmin, async (req, res) => {
  await service.deleteBook(idParam.parse(req.params.id));

  res.status(204).end();
});

booksRouter.put('/:id/tags', async (req, res) => {
  const { tagIds } = bookTagInput.parse(req.body);
  res.json(await service.replaceBookTags(currentUserId(req), idParam.parse(req.params.id), tagIds));
});
