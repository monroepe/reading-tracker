import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { readingInput, readingListQuery, readingUpdate } from './readings.schemas.js';
import { finishedInPeriod, readingPeriod } from './reading-period.js';
import { analyticsQuery, yearInReviewQuery } from '../analytics/analytics.schema.js';

vi.mock('../db/index.js', () => ({ db: {}, pool: {} }));
const dialect = new PgDialect();

describe('reading periods', () => {
  it('accepts Pre-2022 consistently across all period APIs', () => {
    expect(readingListQuery.parse({ year: 'pre-2022' }).year).toBe('pre-2022');
    expect(analyticsQuery.parse({ year: 'pre-2022' }).year).toBe('pre-2022');
    expect(yearInReviewQuery.parse({ year: 'pre-2022' }).year).toBe('pre-2022');
  });
  it.each(['unknown', '2022.5', '1899', '2101', ['2022', '2023']])('rejects invalid periods: %s', (year) => {
    expect(readingPeriod.safeParse(year).success).toBe(false);
  });
  it('groups all earlier completions without manufacturing an individual year', () => {
    const query = dialect.sqlToQuery(finishedInPeriod('pre-2022')!);
    expect(query.sql).toContain('"readings"."finished_on" <');
    expect(query.params).toEqual(['2022-01-01']);
  });
  it('excludes placeholders from numeric-year statistics, including 2021', () => {
    const query = dialect.sqlToQuery(finishedInPeriod(2021)!);
    expect(query.sql).toContain('"readings"."date_uncertain" =');
    expect(query.params).toEqual(['2021-01-01', '2022-01-01', false]);
    expect(finishedInPeriod()).toBeUndefined();
  });
});

describe('import-only uncertainty', () => {
  const input = { bookId: 1, startedOn: '2026-01-01', format: 'Kindle' };
  it.each([true, false, null])('rejects public writes to dateUncertain=%s', (dateUncertain) => {
    expect(readingInput.safeParse({ ...input, dateUncertain }).success).toBe(false);
    expect(readingUpdate.safeParse({ rating: 9, dateUncertain }).success).toBe(false);
  });
  it('keeps normal dates required and validates their order', () => {
    expect(readingInput.safeParse(input).success).toBe(true);
    expect(readingInput.safeParse({ ...input, startedOn: null }).success).toBe(false);
    expect(readingInput.safeParse({ ...input, finishedOn: '2025-12-31' }).success).toBe(false);
    expect(readingUpdate.parse({ rating: 9 })).toEqual({ rating: 9 });
  });
});
