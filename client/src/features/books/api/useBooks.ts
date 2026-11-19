import { useReadData } from '@/data/readData';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BookListParams } from '@/api/types';
import { SHOW_ALL } from '@/features/authors';

export function useBookList(params: BookListParams) {
  const data = useReadData();
  return useQuery({
    queryKey: ['books', 'list', params],
    queryFn: () => data.books.list(params),
    placeholderData: keepPreviousData,
  });
}

// Unpaged list for pickers.
export function useBooks() {
  const data = useReadData();
  return useQuery({
    queryKey: ['books', 'options'],
    queryFn: () => data.books.list({ pageSize: SHOW_ALL }),
    select: (result) => result.data,
  });
}