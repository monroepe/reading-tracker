import { currentUserId, requireAdmin } from '../middleware/auth.js';
import { Router } from 'express';
import { idParam } from '../shared/schemas.js';
import { tagInput, tagSearch } from './tags.schemas.js';
import * as service from './tags.service.js';

export const tagsRouter = Router();

tagsRouter.get('/', async (req, res) => {
  res.json(await service.listTags(tagSearch.parse(req.query)));

});

tagsRouter.get('/admin', requireAdmin, async (req, res) => {
  res.json(await service.listAdminTags(tagSearch.parse(req.query)));
});

tagsRouter.get('/:id', async (req, res) => {
  res.json(await service.getTag(idParam.parse(req.params.id)));
});

tagsRouter.post('/', async (req, res) => {
  const result = await service.createTag(currentUserId(req), tagInput.parse(req.body));
  res.status(result.created ? 201 : 200).json(result.tag);
});

tagsRouter.patch('/:id', requireAdmin, async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await service.updateTag(id, tagInput.parse(req.body)));
});

tagsRouter.delete('/:id', requireAdmin, async (req, res) => {
  await service.deleteTag(idParam.parse(req.params.id));
  res.status(204).end();
});
