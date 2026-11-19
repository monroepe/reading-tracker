import { Fragment, useMemo, type ComponentProps, type ReactNode } from 'react';
import {
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    useReactTable,
    type ColumnDef,
    type OnChangeFn,
    type SortingState,
} from '@tanstack/react-table';
import { DebouncedSearchInput } from '@/components/DebouncedSearchInput';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export interface FilterOption {
    value: string;
    label: string;
}

export interface CustomFilterRenderProps {
    value: string;
    onChange: (value: string) => void;
}

export type ColumnFilterConfig =
    | { type: 'select'; options: FilterOption[] }
    | { type: 'text'; placeholder?: string }
    | { type: 'custom'; render: (props: CustomFilterRenderProps) => ReactNode };

interface DataTableProps<TData> {
    className?: string;
    columns: ColumnDef<TData>[];
    data: TData[];
    /** Provide both to enable server-side sorting; omit for a static table. */
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    /**
     * Server-side column filters. A column shows a header filter only if
     * `filterConfig` has an entry for its column id.
     */
    filters?: Record<string, string>;
    filterConfig?: Record<string, ColumnFilterConfig>;
    onFilterChange?: (columnId: string, value: string) => void;
    /**
     * Opt-in expandable rows. When provided, a leading toggle column is added and
     * the returned content is rendered in a full-width row under an expanded row.
     */
    renderExpandedRow?: (row: TData) => ReactNode;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const SORT_INDICATOR = { asc: '▲', desc: '▼' } as const;

// Radio items need a non-empty value, so "no filter" gets a sentinel.
const ALL = '__all__';

type FilterButtonProps = ComponentProps<typeof Button> & {
    label: string;
    value: string;
};

// Must spread the remaining props: the Popover/Dropdown trigger injects its
// click handler, ref, and aria attributes through them.
function FilterButton({ label, value, ...props }: FilterButtonProps) {
    const active = value !== '';

    return (
        <Button
            {...props}
            variant={active ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 px-0"
            aria-label={`Filter by ${label}${active ? ` (${value})` : ''}`}
        >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
                <path d="M1.5 2h13l-5 6v5l-3 1.5V8l-5-6z" />
            </svg>
        </Button>
    );
}

interface ColumnFilterProps {
    label: string;
    value: string;
    config: ColumnFilterConfig;
    onChange: (value: string) => void;
}

function ColumnFilter({ label, value, config, onChange }: ColumnFilterProps) {
    if (config.type === 'text' || config.type === 'custom') {
        return (
            <Popover>
                <PopoverTrigger render={<FilterButton label={label} value={value} />} />
                <PopoverContent align="start" className="w-64">
                    {config.type === 'text' ? (
                        <DebouncedSearchInput
                            label={`Search ${label}`}
                            placeholder={config.placeholder}
                            value={value}
                            onChange={onChange}
                        />
                    ) : (
                        config.render({ value, onChange })
                    )}
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<FilterButton label={label} value={value} />} />
            <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                    value={value === '' ? ALL : value}
                    onValueChange={(next: string) => onChange(next === ALL ? '' : next)}
                >
                    <DropdownMenuRadioItem value={ALL}>All</DropdownMenuRadioItem>
                    {config.options.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function createExpanderColumn<TData>(): ColumnDef<TData> {
    return {
        id: 'expander',
        size: 48,
        enableSorting: false,
        header: () => <span className="sr-only">Expand row</span>,
        cell: ({ row }) => {
            const expanded = row.getIsExpanded();

            return (
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-8 px-0"
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Collapse row' : 'Expand row'}
                    onClick={row.getToggleExpandedHandler()}
                >
                    <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                </Button>
            );
        },
    };
}

export function DataTable<TData>({
    className,
    columns,
    data,
    sorting,
    onSortingChange,
    filters,
    filterConfig,
    onFilterChange,
    renderExpandedRow,
}: DataTableProps<TData>) {
    const expandable = renderExpandedRow !== undefined;

    // Stable reference: TanStack Table re-derives its models when `columns` changes.
    const tableColumns = useMemo(
        () => (expandable ? [createExpanderColumn<TData>(), ...columns] : columns),
        [expandable, columns],
    );

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns: tableColumns,
        // TanStack gives every column a default size of 150. Clearing it means only
        // columns that set `size` get a fixed width; the rest share the remaining space.
        defaultColumn: { size: undefined },
        state: { sorting },
        onSortingChange,
        manualSorting: true,
        enableSorting: sorting !== undefined,
        enableMultiSort: false,
        enableSortingRemoval: false,
        getRowCanExpand: () => expandable,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
    });

    const columnCount = table.getVisibleLeafColumns().length;

    return (
        // Fixed layout: column widths come from the header row, not the data,
        // so the table doesn't shift when the sort changes. Columns without a
        // `size` share the remaining width, which keeps the table fluid.
        <Table className={['table-fixed', className].filter(Boolean).join(' ')}>
            <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                            const canSort = header.column.getCanSort();
                            const sorted = header.column.getIsSorted();
                            const content = header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext());
                            const config = filterConfig?.[header.column.id];
                            const headerDef = header.column.columnDef.header;
                            const filterLabel = typeof headerDef === 'string' ? headerDef : header.column.id;

                            return (
                                <TableHead
                                    key={header.id}
                                    style={{ width: header.column.columnDef.size }}
                                    aria-sort={canSort ? (sorted ? ARIA_SORT[sorted] : 'none') : undefined}
                                >
                                    <div className="flex items-center gap-1">
                                        {canSort ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="-ml-2"
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                {content}
                                                <span aria-hidden="true" className="inline-block w-3">
                                                    {sorted ? SORT_INDICATOR[sorted] : ''}
                                                </span>
                                            </Button>
                                        ) : (
                                            content
                                        )}
                                        {config && onFilterChange && (
                                            <ColumnFilter
                                                label={filterLabel}
                                                value={filters?.[header.column.id] ?? ''}
                                                config={config}
                                                onChange={(value) => onFilterChange(header.column.id, value)}
                                            />
                                        )}
                                    </div>
                                </TableHead>
                            );
                        })}
                    </TableRow>
                ))}
            </TableHeader>
            <TableBody>
                {table.getRowModel().rows.map((row) => (
                    <Fragment key={row.id}>
                        <TableRow>
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="truncate">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                        {renderExpandedRow && row.getIsExpanded() && (
                            <TableRow>
                                <TableCell colSpan={columnCount} className="whitespace-normal">
                                    {renderExpandedRow(row.original)}
                                </TableCell>
                            </TableRow>
                        )}
                    </Fragment>
                ))}
            </TableBody>
        </Table>
    );
}
