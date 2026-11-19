import { expect, it, vi } from 'vitest';
import { getReadingsByTag } from './analytics.service.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]) => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return { db: drizzle(execute) };
});

it('scopes the main tag chart to personal assignments, completed readings, and finish year', async () => {
  await getReadingsByTag(7, 2025);
  const [query, params] = execute.mock.calls[0];
  expect(query).toContain('"book_tags"."user_id" =');
  expect(query).toContain('"readings"."user_id" =');
  expect(query).toContain('"readings"."abandoned" =');
  expect(query).toContain('"readings"."finished_on" is not null');
  expect(query).toContain('"readings"."finished_on" >=');
  expect(query).not.toContain('started_on');
  expect(params).toEqual([7, 7, false, '2025-01-01', '2026-01-01', false]);
});

it('keeps all-time counts scoped without date bounds', async () => {
  await getReadingsByTag(7);
  const [query, params] = execute.mock.calls[0];
  expect(query).not.toContain('"finished_on" >=');
  expect(params).toEqual([7, 7, false]);
});
