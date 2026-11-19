import type { BookReading } from '@/api/types';

export interface ReadingStats {
    days: number | null;
    pagesPerDay: number | null;
}

export function readingStats(reading: BookReading, pageCount: number, today: string): ReadingStats {
    if (reading.dateUncertain || reading.abandoned) return { days: null, pagesPerDay: null };
    const days = Math.round((Date.parse(reading.finishedOn ?? today) - Date.parse(reading.startedOn)) / 86400000);
    if (!Number.isFinite(days) || days < 0) return { days: null, pagesPerDay: null };
    return { days, pagesPerDay: reading.finishedOn && days > 0 ? pageCount / days : null };
}
