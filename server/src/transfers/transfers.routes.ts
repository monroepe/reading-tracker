import { exportFilename } from '../shared/export-filename.js';
import { z } from 'zod';
import { createPhoneRefresh } from './phone-refresh.service.js';
import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';
import { currentUserId } from '../middleware/auth.js';
import { exportRequest } from './transfer-contract.js';
import { createSnapshotExport } from './transfers.service.js';
import { previewImport } from './import-preview.service.js';
import { commitImport } from './import-commit.service.js';

export const transfersRouter = Router();
transfersRouter.use('/imports', (req, _res, next) => {
  const exchange = req.body?.exchange ?? req.body;
  if (exchange && typeof exchange === 'object' && 'version' in exchange && exchange.version !== 2) throw new HttpError(400, 'Unsupported transfer version. Use the updated Android app and a version-2 file.');
  next();
});

transfersRouter.post('/imports/commit', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await commitImport(currentUserId(req), req.body));
});

transfersRouter.post('/imports/preview', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await previewImport(currentUserId(req), req.body));
});

transfersRouter.post('/exports', async (req, res) => {
  const input = exportRequest.parse(req.body);
  const exchange = await createSnapshotExport(currentUserId(req), input.destinationDeviceId);
  res.set('Cache-Control', 'no-store');
  res.attachment(exportFilename('phone-setup', exchange.createdAt ?? new Date().toISOString()));
  res.type('application/json').send(JSON.stringify(exchange));
});

transfersRouter.post('/refreshes', async (req, res) => {
  const { importId } = z.strictObject({ importId: z.uuid() }).parse(req.body);
  const payload = await createPhoneRefresh(currentUserId(req), importId);
  res.set('Cache-Control', 'no-store');
  res.attachment(exportFilename('phone-refresh', payload.createdAt ?? new Date().toISOString()));
  res.type('application/json').send(JSON.stringify(payload));
});
