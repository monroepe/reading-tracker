import { useReadData } from '@/data/readData';

import { useQuery } from '@tanstack/react-query';

export function useBookReadings(id: number | undefined) {
  const data = useReadData();
    return useQuery({
        queryKey: ['books', id, 'readings'],
        queryFn: () => data.books.readings(id!),
        enabled: id !== undefined,
    });
}