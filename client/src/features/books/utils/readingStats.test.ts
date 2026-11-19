import { expect, it } from 'vitest';
import type { BookReading } from '@/api/types';
import { readingStats } from './readingStats';

const reading: BookReading = { id: 1, startedOn: '2026-10-27', finishedOn: '2026-10-31', dateUncertain: false, abandoned: false, format: 'Print', rating: 7.5, review: null };
it('uses elapsed days and unrounded pace', () => {
    expect(readingStats(reading, 224, '2026-11-11')).toEqual({ days: 4, pagesPerDay: 56 });
});
it('shows ongoing days without pace', () => {
    expect(readingStats({ ...reading, finishedOn: null }, 224, '2026-11-01')).toEqual({ days: 5, pagesPerDay: null });
});
it('handles same-day, uncertain and abandoned readings', () => {
    expect(readingStats({ ...reading, finishedOn: reading.startedOn }, 224, '')).toEqual({ days: 0, pagesPerDay: null });
    for (const flags of [{ dateUncertain: true }, { abandoned: true }]) {
        expect(readingStats({ ...reading, ...flags }, 224, '')).toEqual({ days: null, pagesPerDay: null });
    }
});
it('counts calendar days across daylight saving and year boundaries', () => {
    expect(readingStats({ ...reading, startedOn: '2026-03-07', finishedOn: '2026-03-09' }, 100, '').days).toBe(2);
    expect(readingStats({ ...reading, startedOn: '2025-12-31', finishedOn: '2026-01-01' }, 100, '').days).toBe(1);
});
