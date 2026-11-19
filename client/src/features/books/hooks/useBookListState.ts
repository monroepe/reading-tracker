import { useSearchParams } from 'react-router';
import type { BookListParams, BookSortField, Category } from '@/api/types';
import { useListState } from '@/hooks/useListState';

export type BookFilterKey = 'q' | 'search' | 'authorId' | 'genreId' | 'category';

const SORT_FIELDS: readonly BookSortField[] = [
    'title',
    'author',
    'genre',
    'category',
    'pageCount',
    'rating',
];
const FILTER_KEYS: readonly BookFilterKey[] = ['q', 'search', 'authorId', 'genreId', 'category'];
const CATEGORIES: readonly Category[] = ['Fiction', 'Non-fiction'];

const toId = (value: string) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
};

export function useBookListState() {
    const [searchParams, setSearchParams] = useSearchParams();

    const { sort, order, filters, ...rest } = useListState({
        sortFields: SORT_FIELDS,
        defaultSort: 'title',
        filterKeys: FILTER_KEYS,
    });

    const { q, search, authorId, genreId, category } = filters;

    const tagIds = searchParams
        .getAll('tagId')
        .map(toId)
        .filter((id): id is number => id !== undefined);

    const setTagIds = (ids: number[]) => {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);
                params.delete('tagId');

                for (const id of [...new Set(ids)]) {
                    if (Number.isInteger(id) && id > 0) {
                        params.append('tagId', String(id));
                    }
                }

                params.delete('page');
                return params;
            },
            { replace: true },
        );
    };

    // One update only: separate setSearchParams calls in the same handler each start from the
    // same stale params, so the last one would undo the others.
    const clearFilters = () => {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);

                for (const key of FILTER_KEYS) {
                    params.delete(key);
                }

                params.delete('tagId');
                params.delete('page');
                return params;
            },
            { replace: true },
        );
    };

    const params: BookListParams = {
        sort,
        order,
        ...(q && { q }),
        ...(search && { search }),
        authorId: toId(authorId),
        genreId: toId(genreId),
        category: CATEGORIES.find((c) => c === category),
        ...(tagIds.length > 0 && { tagIds }),
    };

    return {
        params,
        filters,
        hasFilters: rest.hasFilters || tagIds.length > 0,
        setFilter: rest.setFilter,
        clearFilters,
        sorting: rest.sorting,
        onSortingChange: rest.onSortingChange,
        tagIds,
        setTagIds,
    };
}