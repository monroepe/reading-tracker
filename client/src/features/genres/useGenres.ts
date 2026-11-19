import { useReadData } from '@/data/readData';
import { useQuery } from '@tanstack/react-query';

export function useGenres() {
  const data = useReadData();
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => data.genres.list(),
  });
}
