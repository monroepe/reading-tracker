import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from '../middleware/errors.js';
import * as service from './readings.service.js';

vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('./readings.service.js');

const app = createApp();
const json = { 'Content-Type': 'application/json' };
const valid = {
  bookId: 1,
  startedOn: '2026-01-05',
  finishedOn: '2026-01-19',
  format: 'Print',
  rating: 8.5,
};
const emptyPage = { data: [], total: 0, page: 1, pageSize: 100 };
const defaults = { sort: 'finishedOn', order: 'desc', page: 1, pageSize: 100 };

// The test setup makes the current user id 1.
describe('GET /api/readings', () => {
  it('returns the paged result from the service', async () => {
    vi.mocked(service.listReadings).mockResolvedValue(emptyPage);
    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(emptyPage);
  });

  it('scopes the list to the current user and applies defaults', async () => {
    vi.mocked(service.listReadings).mockResolvedValue(emptyPage);
    await request(app).get('/api/readings');
    expect(service.listReadings).toHaveBeenCalledWith(1, defaults);
  });

  it('parses filters, sort and paging', async () => {
    vi.mocked(service.listReadings).mockResolvedValue(emptyPage);
    const res = await request(app).get(
      '/api/readings?q=dune&authorId=7&year=2026&abandoned=false&format=Kindle&genreId=3' +
      '&category=Fiction&sort=rating&order=asc&page=2&pageSize=50',
    );
    expect(res.status).toBe(200);
    expect(service.listReadings).toHaveBeenCalledWith(1, {
      q: 'dune',
      authorId: 7,
      year: 2026,
      abandoned: false,
      format: 'Kindle',
      genreId: 3,
      category: 'Fiction',
      sort: 'rating',
      order: 'asc',
      page: 2,
      pageSize: 50,
    });
  });

  it('trims the title search', async () => {
    vi.mocked(service.listReadings).mockResolvedValue(emptyPage);
    await request(app).get('/api/readings?q=%20%20dune%20%20');
    expect(service.listReadings).toHaveBeenCalledWith(1, { ...defaults, q: 'dune' });
  });

  it.each([
    ['a non-numeric year', 'year=abc'],
    ['an unknown sort field', 'sort=review'],
    ['an invalid order', 'order=sideways'],
    ['an unknown format', 'format=Papyrus'],
    ['an unknown category', 'category=Poetry'],
    ['a non-numeric genreId', 'genreId=abc'],
    ['a non-numeric authorId', 'authorId=abc'],
    ['an invalid abandoned value', 'abandoned=maybe'],
    ['a page below 1', 'page=0'],
    ['a pageSize above 1000', 'pageSize=1001'],
  ])('rejects %s', async (_name, qs) => {
    const res = await request(app).get(`/api/readings?${qs}`);
    expect(res.status).toBe(400);
    expect(service.listReadings).not.toHaveBeenCalled();
  });
});

describe('GET /api/readings/:id', () => {
  it('looks the reading up for the current user', async () => {
    vi.mocked(service.getReading).mockResolvedValue({ id: 5 } as never);
    const res = await request(app).get('/api/readings/5');
    expect(res.status).toBe(200);
    expect(service.getReading).toHaveBeenCalledWith(1, 5);
  });

  it('passes through a 404 from the service', async () => {
    vi.mocked(service.getReading).mockRejectedValue(new HttpError(404, 'Reading not found'));
    const res = await request(app).get('/api/readings/999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/readings', () => {
  it('creates a reading for the current user', async () => {
    vi.mocked(service.createReading).mockResolvedValue({ id: 5 } as never);
    const res = await request(app).post('/api/readings').set(json).send(valid);
    expect(res.status).toBe(201);
    expect(service.createReading).toHaveBeenCalledWith(1, valid);
  });

  it.each([
    ['a rating that is not a half step', { ...valid, rating: 7.3 }],
    ['a rating above 10', { ...valid, rating: 10.5 }],
    ['an abandoned reading with a finish date', { ...valid, abandoned: true }],
    ['a finish date before the start date', { ...valid, finishedOn: '2026-01-01' }],
    ['an impossible date', { ...valid, startedOn: '2026-02-30', finishedOn: null }],
    ['an unknown format', { ...valid, format: 'Papyrus' }],
  ])('rejects %s', async (_name, body) => {
    const res = await request(app).post('/api/readings').set(json).send(body);
    expect(res.status).toBe(400);
    expect(service.createReading).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/readings/:id', () => {
  it('updates for the current user', async () => {
    vi.mocked(service.updateReading).mockResolvedValue({ id: 5 } as never);
    const res = await request(app).patch('/api/readings/5').set(json).send({ rating: 9 });
    expect(res.status).toBe(200);
    expect(service.updateReading).toHaveBeenCalledWith(1, 5, { rating: 9 });
  });

  it('rejects an empty body', async () => {
    const res = await request(app).patch('/api/readings/5').set(json).send({});
    expect(res.status).toBe(400);
    expect(service.updateReading).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/readings/:id', () => {
  it('deletes for the current user', async () => {
    vi.mocked(service.deleteReading).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/readings/5');
    expect(res.status).toBe(204);
    expect(service.deleteReading).toHaveBeenCalledWith(1, 5);
  });
});