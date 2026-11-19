import { createContext, useContext } from 'react';
import { api } from '@/api/client';
import { toQueryString } from '@/api/queryString';
import type { Author, AuthorBook, AuthorListItem, AuthorListParams, Book, BookDetail, BookListParams, BookReading, Genre, Paged, Reading, ReadingListParams, Tag } from '@/api/types';

type Options = { signal?: AbortSignal };
export interface ReadData {
  analytics?: {
    topAuthors(sort: import('@/features/analytics/useAnalytics').TopAuthorsSort, include: boolean): Promise<import('@/features/analytics/useAnalytics').TopAuthor[]>;
    byFormat(year?: import('@/lib/readingPeriod').ReadingPeriod): Promise<import('@/features/analytics/useAnalytics').ReadingFormatCount[]>;
    byCategory(year?: import('@/lib/readingPeriod').ReadingPeriod): Promise<import('@/features/analytics/useAnalytics').ReadingCategoryCount[]>;
    byGenre(year?: import('@/lib/readingPeriod').ReadingPeriod): Promise<import('@/features/analytics/useAnalytics').ReadingGenreCount[]>;
    byTag(year?: import('@/lib/readingPeriod').ReadingPeriod): Promise<import('@/features/analytics/useAnalytics').ReadingTagCount[]>;
    byYear(filters: import('@/features/analytics/useAnalytics').ReadingsByYearFilters): Promise<import('@/features/analytics/useAnalytics').ReadingYearCount[]>;
    review(year: import('@/lib/readingPeriod').ReadingPeriod, options: import('@/features/analytics/useAnalytics').YearInReviewOptions): Promise<import('@/features/analytics/useAnalytics').YearInReview>;
  };
  books: {
    list(params: BookListParams, options?: Options): Promise<Paged<Book>>;
    detail(id: number): Promise<BookDetail>;
    readings(id: number): Promise<BookReading[]>;
  };
  authors: {
    list(params: AuthorListParams): Promise<Paged<AuthorListItem>>;
    detail(id: number): Promise<Author>;
    books(id: number): Promise<AuthorBook[]>;
    countries(): Promise<string[]>;
  };
  readings: { detail?(id: number): Promise<Reading>; list(params: ReadingListParams): Promise<Paged<Reading>> };
  countries?: { list(): Promise<Genre[]> };
  genres: { list(): Promise<Genre[]> };
  tags: { list(params: { q?: string; page: number; pageSize: number }, options?: Options): Promise<Paged<Tag>> };
}

export const httpReadData: ReadData = {
  books: {
    list: (params, options) => api(`/books${toQueryString(params)}`, options),
    detail: id => api(`/books/${id}`),
    readings: id => api(`/books/${id}/readings`),
  },
  authors: {
    list: params => api(`/authors${toQueryString(params)}`),
    detail: id => api(`/authors/${id}`),
    books: id => api(`/authors/${id}/books`),
    countries: () => api('/authors/countries'),
  },
  readings: { detail: id => api(`/readings/${id}`), list: params => api(`/readings${toQueryString(params)}`) },
  countries: { list: () => api('/countries') },
  genres: { list: () => api('/genres') },
  tags: { list: (params, options) => api(`/tags${toQueryString(params)}`, options) },
};

// Desktop defaults to HTTP; the companion must provide its local implementation.
export const ReadDataContext = createContext<ReadData>(httpReadData);
export function useReadData(): ReadData { return useContext(ReadDataContext); }
