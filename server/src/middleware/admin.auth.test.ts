import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { HttpError } from './errors.js';
import * as books from '../books/books.service.js';
import * as authors from '../authors/authors.service.js';
import * as tags from '../tags/tags.service.js';
import { getUser } from '../auth/auth.service.js';

vi.unmock('./auth.js');
vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
vi.mock('../auth/auth.service.js', () => ({ getUser: vi.fn(), login: vi.fn() }));
vi.mock('../books/books.service.js');
vi.mock('../tags/tags.service.js');
vi.mock('../authors/authors.service.js');
vi.mock('./session.js', () => ({
  SESSION_COOKIE: 'rt.sid',
  createSessionMiddleware: () => (req: { headers: Record<string, string>; session: object }, _res: unknown, next: () => void) => {
    req.session = req.headers['x-test-user'] ? { userId: Number(req.headers['x-test-user']) } : {};
    next();
  },
}));

const app = createApp();
beforeEach(() => {
  vi.mocked(getUser).mockResolvedValue({ id: 7, email: 'reader@example.test', role: 'user' });
});

describe('catalog authorization', () => {
  it.each([
    ['patch', '/api/books/1'], ['delete', '/api/books/1'],
    ['patch', '/api/authors/1'], ['delete', '/api/authors/1'],
    ['post', '/api/countries'], ['patch', '/api/countries/1'],
    ['post', '/api/genres'], ['patch', '/api/genres/1'], ['delete', '/api/genres/1'],
    ['patch', '/api/tags/1'], ['delete', '/api/tags/1'], ['get', '/api/tags/admin'],
  ] as const)('rejects regular users for %s %s', async (method, path) => {
    const response = await request(app)[method](path).set('x-test-user', '7').send({ name: 'Changed' });
    expect(response.status).toBe(403);
    expect(getUser).toHaveBeenCalledWith(7);
    expect(tags.updateTag).not.toHaveBeenCalled();
    expect(tags.deleteTag).not.toHaveBeenCalled();
    expect(books.updateBook).not.toHaveBeenCalled();
    expect(books.deleteBook).not.toHaveBeenCalled();
    expect(authors.updateAuthor).not.toHaveBeenCalled();
    expect(authors.deleteAuthor).not.toHaveBeenCalled();
  });

  const bookInput = { title: 'Dune', authorId: 1, genreId: 1, category: 'Fiction', pageCount: 412, tagIds: [2] };
  const authorInput = { firstName: 'Frank', lastName: 'Herbert' };

  it.each(['user', 'admin'] as const)('lets a %s create shared catalog records', async (role) => {
    vi.mocked(getUser).mockResolvedValue({ id: 7, email: 'reader@example.test', role });
    vi.mocked(books.createBook).mockResolvedValue({ id: 12 } as never);
    vi.mocked(authors.createAuthor).mockResolvedValue({ id: 13 } as never);
    const book = await request(app).post('/api/books').set('x-test-user', '7').send(bookInput);
    const author = await request(app).post('/api/authors').set('x-test-user', '7').send(authorInput);
    expect(book.status).toBe(201);
    expect(author.status).toBe(201);
    expect(books.createBook).toHaveBeenCalledWith(7, bookInput);
    expect(authors.createAuthor).toHaveBeenCalledWith(authorInput);

    if (role === 'user') {
      for (const path of ['/api/books/12', '/api/authors/13']) {
        expect((await request(app).patch(path).set('x-test-user', '7').send({ title: 'Changed' })).status).toBe(403);
        expect((await request(app).delete(path).set('x-test-user', '7')).status).toBe(403);
      }
      expect(books.updateBook).not.toHaveBeenCalled();
      expect(books.deleteBook).not.toHaveBeenCalled();
      expect(authors.updateAuthor).not.toHaveBeenCalled();
      expect(authors.deleteAuthor).not.toHaveBeenCalled();
    }
  });

  it.each(['/api/books', '/api/authors'])('requires a session to create at %s', async (path) => {
    expect((await request(app).post(path).send(bookInput)).status).toBe(401);
    expect(books.createBook).not.toHaveBeenCalled();
    expect(authors.createAuthor).not.toHaveBeenCalled();
  });

  it.each(['/api/books', '/api/authors'])('validates regular-user creation at %s', async (path) => {
    expect((await request(app).post(path).set('x-test-user', '7').send({})).status).toBe(400);
    expect(books.createBook).not.toHaveBeenCalled();
    expect(authors.createAuthor).not.toHaveBeenCalled();
  });

  it.each(['/api/books', '/api/authors'])('returns a duplicate conflict at %s', async (path) => {
    const duplicate = { code: '23505' };
    vi.mocked(books.createBook).mockRejectedValue(duplicate);
    vi.mocked(authors.createAuthor).mockRejectedValue(duplicate);
    const response = await request(app).post(path).set('x-test-user', '7').send(path === '/api/books' ? bookInput : authorInput);
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Already exists' });
  });

  it('lets admins edit and delete books and authors', async () => {
    vi.mocked(getUser).mockResolvedValue({ id: 7, email: 'admin@example.test', role: 'admin' });
    vi.mocked(books.updateBook).mockResolvedValue({ id: 1 } as never);
    vi.mocked(authors.updateAuthor).mockResolvedValue({ id: 1 } as never);
    vi.mocked(books.deleteBook).mockResolvedValue();
    vi.mocked(authors.deleteAuthor).mockResolvedValue();
    expect((await request(app).patch('/api/books/1').set('x-test-user', '7').send({ title: 'Changed' })).status).toBe(200);
    expect((await request(app).patch('/api/authors/1').set('x-test-user', '7').send({ lastName: 'Changed' })).status).toBe(200);
    for (const path of ['/api/books/1', '/api/authors/1']) {
      expect((await request(app).delete(path).set('x-test-user', '7')).status).toBe(204);
    }
    expect(books.updateBook).toHaveBeenCalledWith(7, 1, { title: 'Changed' });
    expect(authors.updateAuthor).toHaveBeenCalledWith(1, { lastName: 'Changed' });
    expect(books.deleteBook).toHaveBeenCalledWith(1);
    expect(authors.deleteAuthor).toHaveBeenCalledWith(1);
  });

  it('requires a session for personal tag writes', async () => {
    expect((await request(app).put('/api/books/1/tags').send({ tagIds: [] })).status).toBe(401);
    expect(books.replaceBookTags).not.toHaveBeenCalled();
  });

  it('lets regular users replace their own assignments', async () => {
    vi.mocked(books.replaceBookTags).mockResolvedValue({ id: 1, title: 'Book', tags: [] } as never);
    const response = await request(app).put('/api/books/1/tags').set('x-test-user', '7').send({ tagIds: [2, 2, 3] });
    expect(response.status).toBe(200);
    expect(books.replaceBookTags).toHaveBeenCalledWith(7, 1, [2, 3]);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('does not accept a forged assignment owner', async () => {
    const response = await request(app).put('/api/books/1/tags').set('x-test-user', '7').send({ tagIds: [], userId: 1 });
    expect(response.status).toBe(400);
    expect(books.replaceBookTags).not.toHaveBeenCalled();
  });

  it('attributes tag creation to the current user and returns 200 for reuse', async () => {
    vi.mocked(tags.createTag).mockResolvedValue({ tag: { id: 2, name: 'Fun' }, created: false });
    const response = await request(app).post('/api/tags').set('x-test-user', '7').send({ name: ' fun ', createdByUserId: 1 });
    expect(response.status).toBe(200);
    expect(tags.createTag).toHaveBeenCalledWith(7, { name: 'fun' });
    expect(response.body).toEqual({ id: 2, name: 'Fun' });
  });

  it('checks the current database role for every admin request', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: 7, email: 'admin@example.test', role: 'admin' });
    vi.mocked(tags.deleteTag).mockResolvedValue();
    expect((await request(app).delete('/api/tags/2').set('x-test-user', '7')).status).toBe(204);
    expect((await request(app).delete('/api/tags/2').set('x-test-user', '7')).status).toBe(403);
    expect(tags.deleteTag).toHaveBeenCalledTimes(1);
  });

  it('rejects an account that no longer exists', async () => {
    vi.mocked(getUser).mockRejectedValue(new HttpError(401, 'Not authenticated'));
    expect((await request(app).delete('/api/tags/2').set('x-test-user', '7')).status).toBe(401);
  });
});
