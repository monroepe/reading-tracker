import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBook, getBook, listBooks, replaceBookTags, updateBook } from './books.service.js';
import { bookList } from './books.schemas.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]): Promise<{ rows: unknown[][] }> => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  const db = drizzle(execute);
  // Proxy transactions cannot execute; transaction semantics are covered by the PostgreSQL test.
  db.transaction = async (callback) => callback(db as never);
  return { db };
});

const bookRow = [1, 'The Hobbit', null, 'Fiction', 310, 1, 'J.', 'R. R.', 'Tolkien', 1, 'Fantasy'];
beforeEach(() => {
  execute.mockImplementation(async (query) => {
    if (query.includes('last_readings')) return { rows: [] };
    if (query.includes('count(*)')) return { rows: [[1]] };
    if (query.startsWith('select') && query.includes('inner join "authors"')) return { rows: [bookRow] };
    if (query.startsWith('select') && query.includes('from "books"')) return { rows: [[1]] };
    if (query.startsWith('insert into "books"')) return { rows: [[1]] };
    return { rows: [] };
  });
});

describe('personal book tags', () => {
  it('scopes detail tags and includes the full author name', async () => {
    const result = await getBook(7, 1);
    expect(result.author).toEqual({ id: 1, firstName: 'J.', middleName: 'R. R.', lastName: 'Tolkien' });
    const query = execute.mock.calls.find(([sql]) => sql.includes('from "book_tags"'));
    expect(query?.[0]).toContain('"book_tags"."user_id" =');
    expect(query?.[1]).toEqual([1, 7]);
  });

  it('scopes tag filtering in both list and count queries', async () => {
    await listBooks(7, bookList.parse({ tagIds: [4] }));
    for (const [query, params] of execute.mock.calls) {
      expect(query).toContain('"book_tags"."user_id" =');
      expect(params).toContain(7);
      expect(params).toContain(4);
    }
  });

  it('replaces only the acting admin’s assignments during a catalog update', async () => {
    await updateBook(7, 1, { tagIds: [4] });
    const deletion = execute.mock.calls.find(([sql]) => sql.startsWith('delete from "book_tags"'));
    expect(deletion?.[0]).toContain('"book_tags"."user_id" =');
    expect(deletion?.[1]).toEqual([1, 7]);
    const insertion = execute.mock.calls.find(([sql]) => sql.startsWith('insert into "book_tags"'));
    expect(insertion?.[1]).toEqual([7, 1, 4]);
  });

  it('attributes assignments on new catalog books to the acting user', async () => {
    await createBook(7, { title: 'The Hobbit', authorId: 1, genreId: 1, category: 'Fiction', pageCount: 310, tagIds: [4] });
    const insertion = execute.mock.calls.find(([sql]) => sql.startsWith('insert into "book_tags"'));
    expect(insertion?.[1]).toEqual([7, 1, 4]);
  });

  it('removes only personal assignments when an empty selection is saved', async () => {
    await replaceBookTags(7, 1, []);
    const deletion = execute.mock.calls.find(([sql]) => sql.startsWith('delete from "book_tags"'));
    expect(deletion?.[1]).toEqual([7, 1]);
    expect(execute.mock.calls.some(([sql]) => sql.startsWith('insert'))).toBe(false);
  });
});
