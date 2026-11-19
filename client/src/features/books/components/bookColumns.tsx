import { FormLink } from '@/components/FormLink';
import { CatalogEdit } from '@/features/auth/CatalogEdit';
import type { ColumnDef } from '@tanstack/react-table';
import { Star } from 'lucide-react';
import { formatAuthor } from '../../../lib/format';
import type { Book } from '../../../api/types';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router';

import { BookTagBadges } from './BookTagBadges';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

export const bookColumns: ColumnDef<Book>[] = [
    {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row, getValue }) => (
            <Link to={`/books/${row.original.id}`} className={linkClass}>
                {getValue<string>()}
            </Link>
        ),
    },
    {
        id: 'author',
        header: 'Author',
        accessorFn: (book) => formatAuthor(book.author),
        cell: ({ row, getValue }) => (
            <div>
                <Link to={`/authors/${row.original.author.id}`} className={linkClass}>
                    {getValue<string>()}
                </Link>
                {row.original.coAuthors && <div className="text-sm text-muted-foreground">{row.original.coAuthors}</div>}
            </div>
        ),
    },
    {
        id: 'genre',
        header: 'Genre',
        size: 150,
        accessorFn: (book) => book.genre.name,
    },
    {
        accessorKey: 'category',
        header: 'Category',
        size: 130,
    },
    {
        accessorKey: 'pageCount',
        header: 'Pages',
        size: 90,
    },
    {
        accessorKey: 'tags',
        header: 'Tags',
        enableSorting: false,
        cell: ({ row }) => <BookTagBadges tags={row.original.tags ?? []} />,
    },
    {
        id: 'rating',
        header: 'Rating',
        size: 90,
        accessorFn: (book) => book.lastReading?.rating ?? null,
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
        id: 'actions',
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
            <div className="flex gap-2">
                <CatalogEdit><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/books/${row.original.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></CatalogEdit>
            </div>
        ),
    },
];
