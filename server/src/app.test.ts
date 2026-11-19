import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { db } from './db/index.js';

vi.mock('./db/index.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
  pool: {},
}));

const app = createApp();

describe('API basics', () => {
  it('reports ok when the database responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns a 500 when the database check fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

it.each([
  ['/api/auth/login', '{', 400, 'Invalid JSON'],
  ['/api/auth/login', JSON.stringify({ value: 'x'.repeat(110_000) }), 413, 'Request body is too large'],
  ['/api/transfers/imports/preview', '{', 400, 'Invalid transfer JSON'],
])('handles parser errors at %s', async (path, body, status, message) => {
  const res = await request(app).post(path).set('Content-Type', 'application/json').send(body);
  expect(res.status).toBe(status);
  expect(res.body).toEqual({ error: message });
});
