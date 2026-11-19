import { FormLink } from '@/components/FormLink';
import { CatalogEdit } from '@/features/auth/CatalogEdit';
import type { ColumnDef } from '@tanstack/react-table';
import { formatAuthor } from '../../../lib/format';
import type { AuthorListItem } from '../../../api/types';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router';

export const authorColumns: ColumnDef<AuthorListItem>[] = [
    {
        id: 'name',
        header: 'Name',
        accessorFn: (author) => formatAuthor(author),
        cell: ({ row, getValue }) => (
            <Link to={`/authors/${row.original.id}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                {getValue<string>()}
            </Link>
        ),
    },
    {
        accessorKey: 'country',
        header: 'Country',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
        accessorKey: 'gender',
        header: 'Gender',
        cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
        accessorKey: 'bookCount',
        header: 'Books',
        size: 100,
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
                    render={<FormLink to={`/authors/${row.original.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></CatalogEdit>
            </div>
        ),
    },
];