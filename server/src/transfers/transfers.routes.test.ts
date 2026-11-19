import { createPhoneRefresh } from './phone-refresh.service.js';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from '../middleware/errors.js';
import { createSnapshotExport } from './transfers.service.js';
import type { SnapshotExchange } from './transfer-contract.js';
import { previewImport } from './import-preview.service.js';
import { commitImport } from './import-commit.service.js';

vi.mock('./phone-refresh.service.js');
vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('./transfers.service.js');
vi.mock('./import-preview.service.js');
vi.mock('./import-commit.service.js');
const app = createApp();
const snapshot: SnapshotExchange = {
  format: 'reading-tracker', version: 2, kind: 'snapshot',
  transferId: '11111111-1111-4111-8111-111111111111',
  sourceDeviceId: '22222222-2222-4222-8222-222222222222',
  libraryId: '33333333-3333-4333-8333-333333333333', destinationDeviceId: null, records: [],
};

it('downloads a private snapshot for the authenticated owner', async () => {
  vi.mocked(createSnapshotExport).mockResolvedValue(snapshot);
  const response = await request(app).post('/api/transfers/exports').send({ kind: 'snapshot' });
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-disposition']).toContain('reading-tracker-phone-setup-');
  expect(response.body).toEqual(snapshot);
  expect(createSnapshotExport).toHaveBeenCalledWith(1, null);
});

it.each([
  { kind: 'incremental' }, { kind: 'snapshot', userId: 2 },
  { kind: 'snapshot', libraryId: snapshot.libraryId },
  { kind: 'snapshot', destinationDeviceId: 'invalid' },
])('rejects invalid or caller-selected ownership: %j', async body => {
  const response = await request(app).post('/api/transfers/exports').send(body);
  expect(response.status).toBe(400);
  expect(createSnapshotExport).not.toHaveBeenCalled();
});

it('passes the optional destination device to the service', async () => {
  vi.mocked(createSnapshotExport).mockResolvedValue(snapshot);
  await request(app).post('/api/transfers/exports').send({ kind: 'snapshot', destinationDeviceId: snapshot.libraryId });
  expect(createSnapshotExport).toHaveBeenCalledWith(1, snapshot.libraryId);
});

it('returns an account error without creating a download', async () => {
  vi.mocked(createSnapshotExport).mockRejectedValue(new HttpError(401, 'Account no longer exists'));
  const response = await request(app).post('/api/transfers/exports').send({ kind: 'snapshot' });
  expect(response.status).toBe(401);
  expect(response.headers['content-disposition']).toBeUndefined();
});

it('routes import preview through the authenticated owner and disables caching', async () => {
  const result = { discardedChangeIds: [], localReferences: {}, transferId: snapshot.transferId, previewDigest: 'digest', completedResult: undefined, references: {}, counts: {
    insert: 0, update: 0, skip: 0, conflict: 0, match: 0, blocked: 0,
  }, items: [], aliases: [], automaticTagMappings: [], referenceIssues: [], requiresReview: false, hasBlockingIssues: false };
  vi.mocked(previewImport).mockResolvedValue(result);
  const body = { format: 'reading-tracker', version: 2, kind: 'changes', changes: [] };
  const response = await request(app).post('/api/transfers/imports/preview').send(body);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual(result);
  expect(previewImport).toHaveBeenCalledWith(1, body);
});

it('rejects malformed transfer JSON without passing it to preview', async () => {
  const response = await request(app).post('/api/transfers/imports/preview')
    .set('Content-Type', 'application/json').send('{invalid');
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: 'Invalid transfer JSON' });
  expect(previewImport).not.toHaveBeenCalled();
});

it('commits through the authenticated owner with no caching', async () => {
  const result = { transferId: snapshot.transferId, outcomes: [] };
  vi.mocked(commitImport).mockResolvedValue(result);
  const body = { exchange: {}, previewDigest: 'digest', choices: [] };
  const response = await request(app).post('/api/transfers/imports/commit').send(body);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual(result);
  expect(commitImport).toHaveBeenCalledWith(1, body);
});

it('downloads a confirmed phone refresh for the authenticated owner', async () => {
  const payload = { format: 'reading-tracker' as const, version: 2 as const, kind: 'phone-refresh' as const,
    exchange: { ...snapshot, kind: 'changes' as const, destinationDeviceId: snapshot.sourceDeviceId, sourceDeviceId: snapshot.libraryId, changes: [] },
    snapshot };
  vi.mocked(createPhoneRefresh).mockResolvedValue(payload);
  const response = await request(app).post('/api/transfers/refreshes').send({ importId: snapshot.transferId });
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-disposition']).toContain('reading-tracker-phone-refresh-');
  expect(createPhoneRefresh).toHaveBeenCalledWith(1, snapshot.transferId);
});
