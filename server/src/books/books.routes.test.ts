import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from '../middleware/errors.js';
import * as service from './books.service.js';

vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('./books.service.js');

const app = createApp();
const book = {
    tags: [],
    id: 1,
    title: 'Dune',
    coAuthors: null,
    category: 'Fiction',
    pageCount: 412,
    author: { id: 1, firstName: 'Frank', middleName: '', lastName: 'Herbert' },
    genre: { id: 1, name: 'Sci-Fi' },
    lastReading: {
        id: 7,
        startedOn: '2026-03-01',
        finishedOn: '2026-03-20',
        dateUncertain: false, abandoned: false,
        format: 'Print',
        rating: 9.5,
        review: 'Great.',
    },
};
const unreadBook = { ...book, id: 2, title: 'Emma', lastReading: null };
const listResult = { data: [book, unreadBook], total: 2, page: 1, pageSize: 25 };

describe('GET /api/books', () => {
    it('returns the paged result and applies defaults when no params are sent', async () => {
        vi.mocked(service.listBooks).mockResolvedValue(listResult);
        const res = await request(app).get('/api/books');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(listResult);
        expect(service.listBooks).toHaveBeenCalledWith(1, {
            sort: 'title',
            order: 'asc',
            page: 1,
            pageSize: 25,
        });
    });

    it('parses search, filters, sort, and paging from the query string', async () => {
        vi.mocked(service.listBooks).mockResolvedValue(listResult);
        const res = await request(app).get(
            '/api/books?q=dune&authorId=1&genreId=2&category=Fiction&sort=pageCount&order=desc&page=2&pageSize=10',
        );
        expect(res.status).toBe(200);
        expect(service.listBooks).toHaveBeenCalledWith(1, {
            q: 'dune',
            authorId: 1,
            genreId: 2,
            category: 'Fiction',
            sort: 'pageCount',
            order: 'desc',
            page: 2,
            pageSize: 10,
        });
    });

    it('accepts rating as a sort field', async () => {
        vi.mocked(service.listBooks).mockResolvedValue(listResult);
        const res = await request(app).get('/api/books?sort=rating&order=desc');
        expect(res.status).toBe(200);
        expect(service.listBooks).toHaveBeenCalledWith(1, {
            sort: 'rating',
            order: 'desc',
            page: 1,
            pageSize: 25,
        });
    });

    it.each([
        ['a sort field outside the whitelist', 'sort=password'],
        ['an invalid sort order', 'order=sideways'],
        ['a category outside the allowed list', 'category=Poetry'],
        ['a non-numeric author id', 'authorId=abc'],
        ['an author id below 1', 'authorId=0'],
        ['a negative genre id', 'genreId=-1'],
        ['a page below 1', 'page=0'],
        ['a page size above the maximum', 'pageSize=1001'],
    ])('rejects %s without calling the service', async (_label, query) => {
        const res = await request(app).get(`/api/books?${query}`);
        expect(res.status).toBe(400);
        expect(service.listBooks).not.toHaveBeenCalled();
    });
});

describe('GET /api/books/:id/readings', () => {
    const bookReadings = [
        {
            id: 7,
            startedOn: '2026-03-01',
            finishedOn: '2026-03-20',
            dateUncertain: false, abandoned: false,
            format: 'Print',
            rating: 9.5,
            review: 'Great.',
        },
        {
            id: 3,
            startedOn: '2024-01-05',
            finishedOn: null,
            dateUncertain: false, abandoned: false,
            format: 'Kindle',
            rating: null,
            review: null,
        },
    ];

    it('returns the book’s readings scoped to the logged-in user', async () => {
        vi.mocked(service.listBookReadings).mockResolvedValue(bookReadings);
        const res = await request(app).get('/api/books/2/readings');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(bookReadings);
        expect(service.listBookReadings).toHaveBeenCalledWith(1, 2);
    });

    it('returns an empty array when the book has no readings', async () => {
        vi.mocked(service.listBookReadings).mockResolvedValue([]);
        const res = await request(app).get('/api/books/2/readings');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('rejects a non-numeric id without calling the service', async () => {
        const res = await request(app).get('/api/books/abc/readings');
        expect(res.status).toBe(400);
        expect(service.listBookReadings).not.toHaveBeenCalled();
    });

    it('passes through a 404 from the service', async () => {
        vi.mocked(service.listBookReadings).mockRejectedValue(new HttpError(404, 'Book not found'));
        const res = await request(app).get('/api/books/999/readings');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Book not found' });
    });
});

describe('personal book tag endpoints', () => {
  it('scopes detail tags to the logged-in user', async () => {
    vi.mocked(service.getBook).mockResolvedValue({ ...book, tags: [] });
    const result = await request(app).get('/api/books/1');
    expect(result.status).toBe(200);
    expect(service.getBook).toHaveBeenCalledWith(1, 1);
  });
  it('allows an empty replacement', async () => {
    vi.mocked(service.replaceBookTags).mockResolvedValue({ ...book, tags: [] });
    const result = await request(app).put('/api/books/1/tags').send({ tagIds: [] });
    expect(result.status).toBe(200);
    expect(service.replaceBookTags).toHaveBeenCalledWith(1, 1, []);
  });
  it.each([{ tagIds: [0] }, { tagIds: ['2'] }, {}, { tagIds: null }])('rejects invalid selections %j', async (body) => {
    expect((await request(app).put('/api/books/1/tags').send(body)).status).toBe(400);
    expect(service.replaceBookTags).not.toHaveBeenCalled();
  });
  it('passes the acting user to catalog creation and updates', async () => {
    vi.mocked(service.createBook).mockResolvedValue({ ...book, tags: [] });
    vi.mocked(service.updateBook).mockResolvedValue({ ...book, tags: [] });
    const fields = { title: 'Dune', authorId: 1, genreId: 1, category: 'Fiction', pageCount: 412, tagIds: [2] };
    expect((await request(app).post('/api/books').send(fields)).status).toBe(201);
    expect(service.createBook).toHaveBeenCalledWith(1, fields);
    expect((await request(app).patch('/api/books/1').send({ tagIds: [3] })).status).toBe(200);
    expect(service.updateBook).toHaveBeenCalledWith(1, 1, { tagIds: [3] });
  });
});
