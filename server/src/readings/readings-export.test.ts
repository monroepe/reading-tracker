import { expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { csvCell, exportReadings, legacyHeaders } from './readings-export.js';
vi.mock('../db/index.js', () => ({ db: { execute: vi.fn() } }));
it('quotes multiline text and protects formulas', () => {
  expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
});
it('exports headings for an empty library', async () => {
  vi.mocked(db.execute).mockResolvedValue({ rows: [] } as never);
  expect(await exportReadings(1, false)).toBe('\uFEFF'+legacyHeaders.map(csvCell).join(',')+'\r\n');
});
it('exports calculated numbers and hides uncertain dates', async () => {
  vi.mocked(db.execute).mockResolvedValue({ rows: [
    { title: 'Book', author: 'Author', start: '2026-01-01', finish: '2026-01-05', days: 4, page_count: 225, format: 'Kindle', rating: '8.5' },
    { title: 'Old', date_uncertain: true, start: '2020-01-01', finish: '2020-01-01', days: null, page_count: 200, format: 'Print' },
  ] } as never);
  const csv = await exportReadings(1, true);
  expect(csv).toContain('"4","225","56.3","Kindle","8.5"');
  expect(csv).not.toContain('2020-01-01');
  expect(csv).toContain('"Date Uncertain"');
});
