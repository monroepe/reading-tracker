import { expect, it, vi } from 'vitest';
import { createTag, listTags } from './tags.service.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]): Promise<{ rows: unknown[][] }> => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return { db: drizzle(execute) };
});

it('reuses an existing tag without changing its creator after a duplicate or concurrent create', async () => {
  execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [[4, 'Fun']] });
  expect(await createTag(7, { name: 'fun' })).toEqual({ tag: { id: 4, name: 'Fun' }, created: false });
  expect(execute.mock.calls[0][0]).toContain('on conflict do nothing');
  expect(execute.mock.calls[0][1]).toEqual([7, 'fun']);
  expect(execute.mock.calls[1][1]).toEqual(['fun']);
  expect(execute.mock.calls.some(([sql]) => sql.startsWith('update'))).toBe(false);
});

it('records the creator for a new name', async () => {
  execute.mockResolvedValueOnce({ rows: [[5, 'New tag']] });
  expect(await createTag(7, { name: 'New tag' })).toEqual({ tag: { id: 5, name: 'New tag' }, created: true });
  expect(execute).toHaveBeenCalledTimes(1);
});

it('escapes literal wildcard searches and pages beyond the original limit', async () => {
  execute.mockImplementation(async (query) => ({ rows: query.includes('count(*)') ? [[80]] : [[70, '100%']] }));
  expect(await listTags({ q: '100%', page: 2, pageSize: 50 })).toEqual({ data: [{ id: 70, name: '100%' }], total: 80, page: 2, pageSize: 50 });
  expect(execute.mock.calls[0][1]).toEqual(['%100\\%%', 50, 50]);
});
