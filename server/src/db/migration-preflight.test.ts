import { expect, it, vi } from 'vitest';
import type pg from 'pg';
import { migrationPreflight } from './migration-preflight.js';

it('reports legacy violations without issuing any writes', async () => {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ present: true }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 7 }] })
    .mockResolvedValueOnce({ rows: [{ books: 12, tags: 3, assignments: 4 }] })
    .mockResolvedValueOnce({ rows: [{ table: 'books', id: 4, rule: 'positive page count' }] });
  const result = await migrationPreflight({ query } as unknown as pg.Client, 'owner@example.test');
  expect(result).toEqual({ counts: { books: 12, tags: 3, assignments: 4 }, violations: [{ table: 'books', id: 4, rule: 'positive page count' }] });
  expect(query.mock.calls.every(([sql]) => sql.trimStart().startsWith('SELECT'))).toBe(true);
  expect(query.mock.calls[1][1]).toEqual(['owner@example.test']);
});

it('requires the supplied email to identify an existing account', async () => {
  const query = vi.fn().mockResolvedValueOnce({ rows: [{ present: true }] }).mockResolvedValueOnce({ rowCount: 0, rows: [] });
  await expect(migrationPreflight({ query } as unknown as pg.Client, 'missing@example.test')).rejects.toThrow('exactly one');
  expect(query).toHaveBeenCalledTimes(2);
});

it('supports an empty database without inferring an owner', async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ present: false }] });
  expect(await migrationPreflight({ query } as unknown as pg.Client)).toEqual({ counts: null, violations: [] });
  await expect(migrationPreflight({ query } as unknown as pg.Client, 'owner@example.test')).rejects.toThrow('Create the owner account');
});
