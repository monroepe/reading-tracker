import { beforeEach, expect, it, vi } from 'vitest';
import { listReadings, updateReading } from './readings.service.js';
import { readingListQuery } from './readings.schemas.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]): Promise<{ rows: unknown[][] }> => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return { db: drizzle(execute) };
});
// Reading select order: reading fields, book fields, author fields, genre fields.
const imported = [1, '2021-11-30', '2021-12-30', true, false, 'Kindle', '8.0', null, null,
  2, 'Book', null, 'Fiction', 100, 3, 'Ann', '', 'Smith', 4, 'Fantasy'];
beforeEach(() => {
  execute.mockImplementation(async (query) => ({ rows: query.includes('count(*)') ? [[1]] : query.startsWith('update') ? [[1]] : [imported] }));
});
it('scopes both Pre-2022 queries to the owner and returns completed readings with no duration', async () => {
  const result = await listReadings(7, readingListQuery.parse({ year: 'pre-2022' }));
  expect(result.data[0]).toMatchObject({ dateUncertain: true, finishedOn: '2021-12-30', days: null });
  for (const [sql, params] of execute.mock.calls) {
    expect(sql).toContain('"readings"."user_id" =');
    expect(params.slice(0, 3)).toEqual([7, false, '2022-01-01']);
  }
  expect(execute.mock.calls[0][0]).toContain('"readings"."abandoned" or "readings"."date_uncertain" then null');
});
it('excludes uncertain readings from ordinary year and in-progress filtering', async () => {
  await listReadings(7, readingListQuery.parse({ year: 2026 }));
  for (const [sql, params] of execute.mock.calls) {
    expect(sql).toContain('"readings"."date_uncertain" =');
    expect(params).toContain(2026);
  }
});
it('updates ratings without writing the imported dates or flag', async () => {
  await updateReading(7, 1, { rating: 9 });
  const [sql, params] = execute.mock.calls[0];
  expect(sql).toContain('set "rating" =');
  expect(sql).not.toContain('"started_on"');
  expect(sql).not.toContain('"finished_on"');
  expect(sql).not.toContain('"date_uncertain"');
  expect(params).toEqual(['9', 1, 7]);
});
it.each([{ startedOn: '2026-01-01' }, { finishedOn: null }, { abandoned: true }])('blocks date/status updates on imports: %s', async (input) => {
  execute.mockImplementation(async (sql) => ({ rows: sql.startsWith('update') ? [] : [imported] }));
  await expect(updateReading(7, 1, input)).rejects.toMatchObject({ status: 400 });
  const [sql, params] = execute.mock.calls[0];
  expect(sql).toContain('"readings"."date_uncertain" =');
  expect(params.at(-1)).toBe(false);
});
it('retains 404 behavior for another user’s reading', async () => {
  execute.mockResolvedValue({ rows: [] });
  await expect(updateReading(8, 1, { startedOn: '2026-01-01' })).rejects.toMatchObject({ status: 404 });
  expect(execute.mock.calls.every(([, params]) => params.includes(8))).toBe(true);
});
