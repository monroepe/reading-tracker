import type { AuthorListParams, AuthorSortField } from '@/api/types';
import { useListState } from '@/hooks/useListState';

export type AuthorFilterKey = 'q' | 'country' | 'gender';

const SORT_FIELDS: readonly AuthorSortField[] = [
    'name',
    'firstName',
    'country',
    'gender',
    'bookCount',
];
const DEMO_SORT_FIELDS = ['name', 'firstName', 'bookCount'] as const;
const FILTER_KEYS: readonly AuthorFilterKey[] = ['q', 'country', 'gender'];

export function useAuthorListState(hideDemographics = false) {
    const { sort, order, filters, ...rest } = useListState({
        sortFields: hideDemographics ? DEMO_SORT_FIELDS : SORT_FIELDS,
        defaultSort: 'name',
        filterKeys: hideDemographics ? (['q'] as const) : FILTER_KEYS,
    });

    const { q, country, gender } = filters;
    const params: AuthorListParams = {
        sort,
        order,
        ...(q && { q }),
        ...(country && { country }),
        ...(gender && { gender }),
    };

    return { params, filters, ...rest };
}