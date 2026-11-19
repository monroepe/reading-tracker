import type { ReadingPeriod } from '@/lib/readingPeriod';
import { useQuery } from '@tanstack/react-query';
import { useReadData } from '@/data/readData';
import { api } from '@/api/client';
import { toQueryString } from '@/api/queryString';

export type ReadingFormat = 'Print' | 'Kindle' | 'Audiobook' | 'Graphic Novel';

export type ReadingCategory = 'Fiction' | 'Non-fiction';

export type AuthorGender = 'Female' | 'Male' | 'Non-binary';

export type TopAuthorsSort = 'books' | 'rating';

export type TopBooksFilters = {
    tagId?: number;
    genreId?: number;
    includeGraphicNovels: boolean;
};

export type TopBook = {
    bookId: number;
    title: string;
    authorId: number;
    firstName: string;
    middleName: string;
    lastName: string;
    averageRating: number;
};

export function useTopBooks(filters: TopBooksFilters) {
    return useQuery({
        queryKey: ['analytics', 'top-books', filters],
        queryFn: () => api<TopBook[]>(`/analytics/top-books${toQueryString(filters)}`),
        enabled: filters.tagId !== undefined || filters.genreId !== undefined,
    });
}

export type TopAuthor = {
    authorId: number;
    firstName: string;
  middleName: string;
    lastName: string;
    bookCount: number;
    averageRating: number | null;
    weightedScore: number | null;
};

export function useTopAuthors(sort: TopAuthorsSort, includeGraphicNovels = false) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'top-authors', sort, includeGraphicNovels],
        queryFn: () => reads.analytics ? reads.analytics!.topAuthors(sort, includeGraphicNovels) : api<TopAuthor[]>(`/analytics/top-authors${toQueryString({ sort, includeGraphicNovels })}`),
    });
}

export type ReadingFormatCount = {
    format: ReadingFormat;
    count: number;
};

export type ReadingCategoryCount = {
    category: ReadingCategory;
    count: number;
};

export type ReadingGenreCount = {
    genre: string;
    count: number;
};

export type ReadingTagCount = {
    tag: string;
    count: number;
};

export type ReadingGenderCount = {
    gender: AuthorGender;
    count: number;
};

export type ReadingYearCount = {
    year: ReadingPeriod;
    count: number;
};

export type ReadingsByYearFilters = {
    format?: ReadingFormat;
    genreId?: number;
    category?: ReadingCategory;
};

export type ReadingCountryCount = {
    country: string;
    count: number;
};

export function useReadingsByFormat(year?: ReadingPeriod) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'readings-by-format', year],
        queryFn: () => reads.analytics ? reads.analytics!.byFormat(year) :
            api<ReadingFormatCount[]>(
                `/analytics/readings-by-format${toQueryString({ year })}`,
            ),
    });
}

export function useReadingsByCategory(year?: ReadingPeriod) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'readings-by-category', year],
        queryFn: () => reads.analytics ? reads.analytics.byCategory(year) :
            api<ReadingCategoryCount[]>(
                `/analytics/readings-by-category${toQueryString({ year })}`,
            ),
    });
}

export function useReadingsByGenre(year?: ReadingPeriod) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'readings-by-genre', year],
        queryFn: () => reads.analytics ? reads.analytics.byGenre(year) :
            api<ReadingGenreCount[]>(
                `/analytics/readings-by-genre${toQueryString({ year })}`,
            ),
    });
}

export function useReadingsByTag(year?: ReadingPeriod) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'readings-by-tag', year],
        queryFn: () => reads.analytics ? reads.analytics.byTag(year) :
            api<ReadingTagCount[]>(
                `/analytics/readings-by-tag${toQueryString({ year })}`,
            ),
    });
}

export function useReadingsByGender(year?: ReadingPeriod) {
    return useQuery({
        queryKey: ['analytics', 'readings-by-gender', year],
        queryFn: () =>
            api<ReadingGenderCount[]>(
                `/analytics/readings-by-gender${toQueryString({ year })}`,
            ),
    });
}

export function useReadingsByYear(filters: ReadingsByYearFilters = {}) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'readings-by-year', filters],
        queryFn: () => reads.analytics ? reads.analytics!.byYear(filters) :
            api<ReadingYearCount[]>(
                `/analytics/readings-by-year${toQueryString(filters)}`,
            ),
    });
}

export function useReadingsByCountry(year?: ReadingPeriod) {
    return useQuery({
        queryKey: ['analytics', 'readings-by-country', year],
        queryFn: () =>
            api<ReadingCountryCount[]>(
                `/analytics/readings-by-country${toQueryString({ year })}`,
            ),
    });
}

export type YearInReviewOptions = {
    includeGraphicNovelsInBooks: boolean;
    includeGraphicNovelsInAuthors: boolean;
};

export type YearInReview = {
    year: ReadingPeriod;
    total: number;
    totalPages: number;
    topBooks: { bookId: number; title: string; authorId: number; firstName: string; middleName: string; lastName: string; rating: number }[];
    topAuthors: { authorId: number; firstName: string; middleName: string; lastName: string; bookCount: number }[];
    byFormat: ReadingFormatCount[];
    byCategory: ReadingCategoryCount[];
    byGenre: ReadingGenreCount[];
    byTag: ReadingTagCount[];
};

export function useYearInReview(year: ReadingPeriod, options: YearInReviewOptions) {
    const reads = useReadData();
    return useQuery({
        queryKey: ['analytics', 'year-in-review', year, options],
        // Keep this year's report visible while either ranking option changes.
        placeholderData: (previous, previousQuery) => previousQuery?.queryKey[2] === year ? previous : undefined,
        queryFn: () => reads.analytics ? reads.analytics!.review(year, options) : api<YearInReview>(`/analytics/year-in-review${toQueryString({ year, ...options })}`),
    });
}
