import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from '../middleware/errors.js';
import * as service from './authors.service.js';

vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('./authors.service.js');

const app = createApp();
const author = { id: 1, firstName: 'Frank', middleName: '', lastName: 'Herbert', country: 'USA', countries: [{ id: 1, name: 'USA' }], gender: 'Male' };
const listResult = { data: [{ ...author, bookCount: 1 }], total: 1, page: 1, pageSize: 25 };
const json = { 'Content-Type': 'application/json' };

describe('GET /api/authors', () => {
  it('returns the paged result and applies defaults when no params are sent', async () => {
    vi.mocked(service.listAuthors).mockResolvedValue(listResult);
    const res = await request(app).get('/api/authors');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(listResult);
    expect(service.listAuthors).toHaveBeenCalledWith({
      sort: 'name',
      order: 'asc',
      page: 1,
      pageSize: 25,
    });
  });

  it('parses search, filters, sort, and paging from the query string', async () => {
    vi.mocked(service.listAuthors).mockResolvedValue(listResult);
    const res = await request(app).get(
      '/api/authors?q=herb&country=USA&gender=Male&sort=bookCount&order=desc&page=2&pageSize=10',
    );
    expect(res.status).toBe(200);
    expect(service.listAuthors).toHaveBeenCalledWith({
      q: 'herb',
      country: 'USA',
      gender: 'Male',
      sort: 'bookCount',
      order: 'desc',
      page: 2,
      pageSize: 10,
    });
  });

  it.each([
    ['a sort field outside the whitelist', 'sort=password'],
    ['an invalid sort order', 'order=sideways'],
    ['a gender outside the allowed list', 'gender=Unknown'],
    ['a page below 1', 'page=0'],
    ['a non-numeric page', 'page=abc'],
    ['a page size above the maximum', 'pageSize=1001'],
  ])('rejects %s without calling the service', async (_label, query) => {
    const res = await request(app).get(`/api/authors?${query}`);
    expect(res.status).toBe(400);
    expect(service.listAuthors).not.toHaveBeenCalled();
  });
});

describe('GET /api/authors/countries', () => {
  it('returns the distinct country list', async () => {
    vi.mocked(service.listAuthorCountries).mockResolvedValue(['Canada', 'USA']);
    const res = await request(app).get('/api/authors/countries');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['Canada', 'USA']);
  });

  it('is not shadowed by the /:id route', async () => {
    vi.mocked(service.listAuthorCountries).mockResolvedValue([]);
    await request(app).get('/api/authors/countries');
    expect(service.getAuthor).not.toHaveBeenCalled();
  });
});

describe('GET /api/authors/:id', () => {
  it('returns the author', async () => {
    vi.mocked(service.getAuthor).mockResolvedValue(author);
    const res = await request(app).get('/api/authors/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(author);
    expect(service.getAuthor).toHaveBeenCalledWith(1);
  });

  it('rejects a non-numeric id without calling the service', async () => {
    const res = await request(app).get('/api/authors/abc');
    expect(res.status).toBe(400);
    expect(service.getAuthor).not.toHaveBeenCalled();
  });

  it('passes through a 404 from the service', async () => {
    vi.mocked(service.getAuthor).mockRejectedValue(new HttpError(404, 'Author not found'));
    const res = await request(app).get('/api/authors/999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Author not found' });
  });
});

describe('POST /api/authors', () => {
  it('creates an author from trimmed input', async () => {
    vi.mocked(service.createAuthor).mockResolvedValue(author);
    const res = await request(app)
      .post('/api/authors')
      .set(json)
      .send({ firstName: ' Frank ', middleName: '', lastName: 'Herbert ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(author);
    expect(service.createAuthor).toHaveBeenCalledWith({ firstName: 'Frank', middleName: '', lastName: 'Herbert' });
  });

  it('rejects a missing last name', async () => {
    const res = await request(app).post('/api/authors').set(json).send({ firstName: 'Frank' });
    expect(res.status).toBe(400);
    expect(service.createAuthor).not.toHaveBeenCalled();
  });

  it('rejects a gender outside the allowed list', async () => {
    const res = await request(app).post('/api/authors').set(json).send({ lastName: 'Herbert', gender: 'Unknown' });
    expect(res.status).toBe(400);
    expect(service.createAuthor).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/authors/:id', () => {
  it('updates only the fields that were sent', async () => {
    vi.mocked(service.updateAuthor).mockResolvedValue({ ...author, country: 'Canada' });
    const res = await request(app).patch('/api/authors/1').set(json).send({ countryIds: [1] });
    expect(res.status).toBe(200);
    expect(service.updateAuthor).toHaveBeenCalledWith(1, { countryIds: [1] });
  });

  it('rejects an empty body', async () => {
    const res = await request(app).patch('/api/authors/1').set(json).send({});
    expect(res.status).toBe(400);
    expect(service.updateAuthor).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/authors/:id', () => {
  it('returns 204 with no body', async () => {
    vi.mocked(service.deleteAuthor).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/authors/1');
    expect(res.status).toBe(204);
    expect(service.deleteAuthor).toHaveBeenCalledWith(1);
  });

  it('passes through a 404 from the service', async () => {
    vi.mocked(service.deleteAuthor).mockRejectedValue(new HttpError(404, 'Author not found'));
    const res = await request(app).delete('/api/authors/999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/authors/:id/books', () => {
  const authorBooks = [
    {
      id: 10,
      title: 'Dune',
      coAuthors: null,
      category: 'Fiction',
      pageCount: 412,
      genre: { id: 1, name: 'Science Fiction' },
      readingCount: 2,
      lastReading: {
        id: 5,
        startedOn: '2026-03-01',
        finishedOn: '2026-03-20',
        dateUncertain: false, abandoned: false,
        format: 'Paperback',
        rating: 5,
        review: 'Great.',
      },
    },
    {
      id: 11,
      title: 'Hellstrom’s Hive',
      coAuthors: null,
      category: 'Fiction',
      pageCount: 300,
      genre: { id: 1, name: 'Science Fiction' },
      readingCount: 0,
      lastReading: null,
    },
  ];

  it('returns the author’s books scoped to the logged-in user', async () => {
    vi.mocked(service.listAuthorBooks).mockResolvedValue(authorBooks);
    const res = await request(app).get('/api/authors/2/books');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(authorBooks);
    expect(service.listAuthorBooks).toHaveBeenCalledWith(1, 2);
  });

  it('returns an empty array when the author has no books', async () => {
    vi.mocked(service.listAuthorBooks).mockResolvedValue([]);
    const res = await request(app).get('/api/authors/2/books');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects a non-numeric id without calling the service', async () => {
    const res = await request(app).get('/api/authors/abc/books');
    expect(res.status).toBe(400);
    expect(service.listAuthorBooks).not.toHaveBeenCalled();
  });

  it('passes through a 404 from the service', async () => {
    vi.mocked(service.listAuthorBooks).mockRejectedValue(new HttpError(404, 'Author not found'));
    const res = await request(app).get('/api/authors/999/books');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Author not found' });
  });
});