import type { ColumnDef } from '@tanstack/react-table';
import { Rating } from '@/components/Rating';
import type { ReadingStats } from '../utils/readingStats';
import type { BookReading } from '../../../api/types';

export function readingYear(reading: BookReading): string {
    return reading.dateUncertain ? 'Date uncertain' : reading.finishedOn?.slice(0, 4) ?? '—';
}

export const bookReadingColumns: ColumnDef<BookReading & ReadingStats>[] = [
    {
        id: 'year',
        header: 'Year',
        size: 100,
        accessorFn: (reading) => readingYear(reading),
    },
    {
        accessorKey: 'format',
        header: 'Format',
    },
    { accessorKey: 'days', header: 'Days', size: 80, cell: ({ getValue }) => getValue<number | null>() ?? '—' },
    { accessorKey: 'pagesPerDay', header: 'Pages/day', size: 110, cell: ({ getValue }) => getValue<number | null>()?.toFixed(1) ?? '—' },
    {
        id: 'rating',
        size: 100,
        header: 'Rating',
        accessorFn: (reading) => reading.rating,
        cell: ({ getValue }) => (
            <span className="flex justify-start"><Rating value={getValue<number | null>()} /></span>
        ),
    },
];
