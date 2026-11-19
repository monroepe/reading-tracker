export type ReadingPeriod = number | 'pre-2022';
export const periodLabel = (period: ReadingPeriod) => period === 'pre-2022' ? 'Pre-2022' : String(period);
export function parsePeriod(value: string): ReadingPeriod | undefined {
  if (value === 'pre-2022') return value;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : undefined;
}
