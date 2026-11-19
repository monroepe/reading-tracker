import { useReadData } from '@/data/readData';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AuthorListParams } from '@/api/types';

// Show everything until pagination lands. Matches the server's pageSize cap.
export const SHOW_ALL = 1000;

export function useAuthorList(params: AuthorListParams) {
  const data = useReadData();
  return useQuery({
    queryKey: ['authors', 'list', params],
    queryFn: () => data.authors.list(params),
    placeholderData: keepPreviousData,
  });
}

// Unpaged list for pickers.
export function useAuthors() {
  const data = useReadData();
  return useQuery({
    queryKey: ['authors', 'options'],
    queryFn: () => data.authors.list({ pageSize: SHOW_ALL }),
    select: (result) => result.data,
  });
}

// Distinct countries, used to populate the country column filter.
export function useAuthorCountries() {
  const data = useReadData();
  return useQuery({
    queryKey: ['authors', 'countries'],
    queryFn: () => data.authors.countries(),
  });
}

// Server-searched, small result set for the author combobox.
export function useAuthorSearch(q: string) {
  const data = useReadData();
  return useQuery({
    queryKey: ['authors', 'search', q],
    queryFn: () => data.authors.list({ q, pageSize: 20 }),
    select: (result) => result.data,
    placeholderData: keepPreviousData,
  });
}