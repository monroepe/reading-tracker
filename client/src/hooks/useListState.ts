import type { OnChangeFn, SortingState } from '@tanstack/react-table';
import { useSearchParams } from 'react-router';
import type { SortOrder } from '@/api/types';

interface ListStateConfig<TSort extends string, TFilter extends string> {
    sortFields: readonly TSort[];
    defaultSort: TSort;
    defaultOrder?: SortOrder;
    filterKeys: readonly TFilter[];
    /** Filter keys that stay in place on "clear all" and don't count as an active filter. */
    persistentKeys?: readonly TFilter[];
}

/** Maps URL search params to table state (sorting + filters). Pass module-level config. */
export function useListState<TSort extends string, TFilter extends string>({
    sortFields,
    defaultSort,
    defaultOrder = 'asc',
    filterKeys,
    persistentKeys = [],
}: ListStateConfig<TSort, TFilter>) {
    const [searchParams, setSearchParams] = useSearchParams();

    const rawSort = searchParams.get('sort');
    const sort = sortFields.find((field) => field === rawSort) ?? defaultSort;
    const rawOrder = searchParams.get('order');
    const order: SortOrder = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaultOrder;

    const filters = Object.fromEntries(
        filterKeys.map((key) => [key, searchParams.get(key) ?? '']),
    ) as Record<TFilter, string>;
    const clearableKeys = filterKeys.filter((key) => !persistentKeys.includes(key));
    const hasFilters = clearableKeys.some((key) => filters[key] !== '');

    const sorting: SortingState = [{ id: sort, desc: order === 'desc' }];

    const onSortingChange: OnChangeFn<SortingState> = (updater) => {
        const next = typeof updater === 'function' ? updater(sorting) : updater;
        const [first] = next;
        const field = sortFields.find((f) => f === first?.id);
        if (!first || !field) return;

        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);
                params.set('sort', field);
                params.set('order', first.desc ? 'desc' : 'asc');
                params.delete('page'); // a new sort starts from page 1
                return params;
            },
            { replace: true },
        );
    };

    const setFilter = (key: TFilter, value: string) => {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);
                const trimmed = value.trim();
                if (trimmed) {
                    params.set(key, trimmed);
                } else {
                    params.delete(key);
                }
                params.delete('page'); // a new filter starts from page 1
                return params;
            },
            { replace: true },
        );
    };

    const clearFilters = () => {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);
                for (const key of clearableKeys) params.delete(key);
                params.delete('page');
                return params;
            },
            { replace: true },
        );
    };

    return { sort, order, filters, hasFilters, setFilter, clearFilters, sorting, onSortingChange };
}