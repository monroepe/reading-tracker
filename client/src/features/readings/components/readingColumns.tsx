import { WriteOnly } from '@/components/WriteOnly';
import { FormLink } from '@/components/FormLink';
import { Link } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAuthor } from '../../../lib/format';
import type { Reading } from '../../../api/types';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

export const readingColumns: ColumnDef<Reading>[] = [
    {
        id: 'title',
        header: 'Title',
        accessorFn: (reading) => reading.book.title,
        cell: ({ row, getValue }) => (
            <Link to={`/books/${row.original.book.id}`} className={linkClass}>
                {getValue<string>()}
            </Link>
        ),
    },
    {
        id: 'author',
        header: 'Author',
        accessorFn: (reading) => formatAuthor(reading.author),
        cell: ({ row, getValue }) => (
            <Link to={`/authors/${row.original.author.id}`} className={linkClass}>
                {getValue<string>()}
            </Link>
        ),
    },
    {
        id: 'genre',
        header: 'Genre',
        accessorFn: (reading) => reading.genre.name,
    },
    {
        accessorKey: 'format',
        header: 'Format',
    },
    {
        accessorKey: 'rating',
        header: 'Rating',
        size: 80,
        cell: ({ getValue }) => {
            const rating = getValue<number | null>();
            return rating === null ? <span className="block text-right">—</span> : (
                <span className="flex items-center justify-end gap-1 tabular-nums" aria-label={`${rating} out of 10 stars`}>
                    {rating}<Star className="size-4 fill-current text-amber-500" aria-hidden="true" />
                </span>
            );
        },
    },
    {
        accessorKey: 'finishedOn',
        header: 'Finished',
        cell: ({ row }) => row.original.dateUncertain ? 'Date uncertain' : row.original.finishedOn ?? 'In progress',
    },
    {
        accessorKey: 'days',
        header: 'Days',
        size: 70,
        cell: ({ getValue }) => getValue<number | null>() ?? '—',
    },
    {
        id: 'pagesPerDay',
        header: 'Pages/day',
        size: 90,
        accessorFn: (reading) =>
            !reading.dateUncertain && reading.finishedOn !== null && reading.days
                ? reading.book.pageCount / reading.days
                : null,
        cell: ({ getValue }) => getValue<number | null>()?.toFixed(1) ?? '',
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <div className="flex gap-2">
                <WriteOnly><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/readings/${row.original.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></WriteOnly>
                {!row.original.dateUncertain && row.original.finishedOn === null && (
                    <WriteOnly><Button
                        variant="outline"
                        size="sm"
                        render={<FormLink to={`/readings/${row.original.id}/finish`} />}
                        nativeButton={false}
                    >
                        Finish
                    </Button></WriteOnly>
                )}
            </div>
        ),
    },
];
