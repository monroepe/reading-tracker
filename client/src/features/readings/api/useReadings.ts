import { useReadData } from '@/data/readData';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReadingListParams } from '@/api/types';

export function useReadingList(params: ReadingListParams) {
  const data = useReadData();
  return useQuery({
    queryKey: ['readings', 'list', params],
    queryFn: () => data.readings.list(params),
    placeholderData: keepPreviousData,
  });
}