import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import * as service from './tags.service.js';

vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('./tags.service.js');
const app = createApp();

describe('tag routes', () => {
  it('parses search and paging', async () => {
    vi.mocked(service.listTags).mockResolvedValue({ data: [], total: 70, page: 2, pageSize: 25 });
    const result = await request(app).get('/api/tags?q= fun &page=2&pageSize=25');
    expect(result.status).toBe(200);
    expect(service.listTags).toHaveBeenCalledWith({ q: 'fun', page: 2, pageSize: 25 });
  });
  it.each(['page=0', 'pageSize=101', 'page=abc'])('rejects invalid pagination %s', async (query) => {
    expect((await request(app).get(`/api/tags?${query}`)).status).toBe(400);
    expect(service.listTags).not.toHaveBeenCalled();
  });
  it('returns a new tag with 201', async () => {
    vi.mocked(service.createTag).mockResolvedValue({ tag: { id: 3, name: 'Fun' }, created: true });
    const result = await request(app).post('/api/tags').send({ name: ' Fun ' });
    expect(result.status).toBe(201);
    expect(service.createTag).toHaveBeenCalledWith(1, { name: 'Fun' });
  });
  it('returns admin-only assignment counts through its own endpoint', async () => {
    const data = { data: [{ id: 3, name: 'Fun', assignmentCount: 4 }], total: 1, page: 1, pageSize: 50 };
    vi.mocked(service.listAdminTags).mockResolvedValue(data);
    const result = await request(app).get('/api/tags/admin');
    expect(result.status).toBe(200);
    expect(result.body).toEqual(data);
    expect(service.listAdminTags).toHaveBeenCalledWith({ page: 1, pageSize: 50 });
  });
});
