import { useReadData } from '@/data/readData';
import { useQuery } from '@tanstack/react-query';

export function useReading(id: number) {
  const reads = useReadData();
  return useQuery({
    queryKey: ['readings', id],
    queryFn: () => reads.readings.detail!(id),
    enabled: Number.isFinite(id),
  });
}