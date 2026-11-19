import { useReadData } from '@/data/readData';

import { useQuery } from '@tanstack/react-query';

export function useBook(id: number) {
  const data = useReadData();
    return useQuery({
        queryKey: ['books', id],
        queryFn: () => data.books.detail(id),
    });
}