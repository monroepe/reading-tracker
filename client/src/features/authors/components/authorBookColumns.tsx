import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router';
import { Star } from 'lucide-react';
import type { AuthorBook } from '../../../api/types';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

export const authorBookColumns: ColumnDef<AuthorBook>[] = [
    {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row, getValue }) => (
            <Link
                to={`/books/${row.original.id}`}
                className={`${linkClass} block whitespace-normal break-words`}
            >
                {getValue<string>()}
            </Link>
        ),
    },
    {
        id: 'genre',
        header: 'Genre',
        size: 130,
        accessorFn: (book) => book.genre.name,
    },
    {
        accessorKey: 'pageCount',
        header: 'Pages',
        size: 80,
    },
    {
        accessorKey: 'readingCount',
        header: 'Readings',
        size: 100,
    },
    {
        id: 'format',
        header: 'Format',
        size: 130,
        accessorFn: (book) => book.lastReading?.format,
        cell: ({ getValue }) => getValue<string | undefined>() ?? '—',
    },
    {
        id: 'startedOn',
        header: 'Started',
        size: 120,
        accessorFn: (book) => book.lastReading?.dateUncertain ? 'Date uncertain' : book.lastReading?.startedOn,
        cell: ({ getValue }) => getValue<string | null | undefined>() ?? '—',
    },
    {
        id: 'finishedOn',
        header: 'Finished',
        size: 120,
        accessorFn: (book) => book.lastReading?.dateUncertain ? 'Date uncertain' : book.lastReading?.finishedOn,
        cell: ({ getValue }) => getValue<string | null | undefined>() ?? '—',
    },
    {
        id: 'rating',
        header: 'Rating',
        size: 80,
        accessorFn: (book) => book.lastReading?.rating,
        cell: ({ getValue }) => {
            const rating = getValue<number | null | undefined>();
            return rating == null ? <span className="block text-right">—</span> : (
                <span className="flex items-center justify-end gap-1 tabular-nums" aria-label={`${rating} out of 10 stars`}>
                    {rating}<Star className="size-4 fill-current text-amber-500" aria-hidden="true" />
                </span>
            );
        },
    },
];
