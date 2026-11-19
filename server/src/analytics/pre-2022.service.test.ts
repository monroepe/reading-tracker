import { beforeEach, expect, it, vi } from 'vitest';
import { getReadingsByYear, getReadingsByFormat, getReadingsByCategory, getReadingsByGenre, getReadingsByTag, getReadingsByGender, getReadingsByCountry } from './analytics.service.js';
import { getYearInReview } from './year-in-review.service.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_query: string, _params: unknown[]): Promise<{ rows: unknown[][] }> => ({ rows: [] })) }));
vi.mock('../db/index.js', async () => {
  const { drizzle } = await import('drizzle-orm/pg-proxy');
  return { db: drizzle(execute) };
});
beforeEach(() => { execute.mockResolvedValue({ rows: [] }); });
it.each([getReadingsByFormat, getReadingsByCategory, getReadingsByGenre, getReadingsByTag, getReadingsByGender, getReadingsByCountry])('supports Pre-2022 breakdowns with owner scope', async (getBreakdown) => {
  await getBreakdown(7, 'pre-2022');
  const [sql, params] = execute.mock.calls[0];
  expect(sql).toContain('"readings"."user_id" =');
  expect(sql).toContain('"readings"."finished_on" <');
  expect(params).toContain(7);
  expect(params).toContain('2022-01-01');
  expect(params).not.toContain('2021-01-01');
});
it('returns a labeled Pre-2022 bucket and fills only later numeric year gaps', async () => {
  execute.mockResolvedValue({ rows: [[2021, 74], [2023, 2]] });
  expect(await getReadingsByYear(7)).toEqual([
    { year: 'pre-2022', count: 74 }, { year: 2022, count: 0 }, { year: 2023, count: 2 },
  ]);
  expect(execute.mock.calls[0][0]).toContain("case when \"readings\".\"finished_on\" < DATE '2022-01-01' then 2021");
});
it('supports a review containing only imported completions', async () => {
  execute.mockImplementation(async (sql) => ({ rows: sql.includes('"readings"."id"')
    ? [[1, 2, 'Imported book', 3, 'Ann', '', 'Smith', 'Kindle', '2021-12-30', '8.5', 250]]
    : sql.includes('group by "readings"."format"') ? [['Kindle', 1]] : [] }));
  const result = await getYearInReview(7, { year: 'pre-2022', includeGraphicNovelsInBooks: false, includeGraphicNovelsInAuthors: false });
  expect(result).toMatchObject({ year: 'pre-2022', total: 1, totalPages: 250, topBooks: [{ bookId: 2, rating: 8.5 }], topAuthors: [{ authorId: 3, bookCount: 1 }] });
  for (const [sql, params] of execute.mock.calls) {
    expect(sql).toContain('"readings"."user_id" =');
    expect(params).toContain('2022-01-01');
  }
});
