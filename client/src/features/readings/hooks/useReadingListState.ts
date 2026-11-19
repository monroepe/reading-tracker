import type { Category, Format, ReadingListParams, ReadingSortField } from '@/api/types';
import { parsePeriod } from '@/lib/readingPeriod';
import { useListState } from '@/hooks/useListState';

export type ReadingFilterKey =
    | 'q'
    | 'authorId'
    | 'year'
    | 'abandoned'
    | 'format'
    | 'genreId'
    | 'category';

const SORT_FIELDS: readonly ReadingSortField[] = [
    'title',
    'author',
    'genre',
    'category',
    'pageCount',
    'format',
    'startedOn',
    'finishedOn',
    'days',
    'rating',
];
const FILTER_KEYS: readonly ReadingFilterKey[] = [
    'q',
    'authorId',
    'year',
    'abandoned',
    'format',
    'genreId',
    'category',
];
const PERSISTENT_KEYS: readonly ReadingFilterKey[] = ['year'];
const FORMATS: readonly Format[] = ['Print', 'Kindle', 'Audiobook', 'Graphic Novel'];
const CATEGORIES: readonly Category[] = ['Fiction', 'Non-fiction'];

const toId = (value: string) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
};

const toBool = (value: string) => (value === 'true' ? true : value === 'false' ? false : undefined);

export function useReadingListState() {
    const { sort, order, filters, ...rest } = useListState({
        sortFields: SORT_FIELDS,
        defaultSort: 'finishedOn',
        defaultOrder: 'desc',
        filterKeys: FILTER_KEYS,
        persistentKeys: PERSISTENT_KEYS,
    });

    const { q, authorId, year, abandoned, format, genreId, category } = filters;
    const params: ReadingListParams = {
        sort,
        order,
        ...(q && { q }),
        authorId: toId(authorId),
        year: parsePeriod(year),
        abandoned: toBool(abandoned),
        format: FORMATS.find((f) => f === format),
        genreId: toId(genreId),
        category: CATEGORIES.find((c) => c === category),
    };

    return { params, filters, ...rest };
}