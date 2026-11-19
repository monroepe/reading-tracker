import { and, eq, sql } from 'drizzle-orm';
import { readings } from '../db/schema.js';

import type { ReadingPeriod } from './reading-period.schema.js';
export { readingPeriod, type ReadingPeriod } from './reading-period.schema.js';

// Placeholder dates must never be attributed to a specific calendar year.
export function finishedInPeriod(year?: ReadingPeriod) {
  if (year === undefined) return undefined;
  if (year === 'pre-2022') return sql`${readings.finishedOn} < ${'2022-01-01'}`;
  return and(
    sql`${readings.finishedOn} >= ${`${year}-01-01`}`,
    sql`${readings.finishedOn} < ${`${year + 1}-01-01`}`,
    eq(readings.dateUncertain, false),
  );
}
