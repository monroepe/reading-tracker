import { useReadData } from '@/data/readData';
import { useQuery } from '@tanstack/react-query';


export function useAuthor(id: number | undefined) {
  const data = useReadData();
    return useQuery({
        queryKey: ['authors', id],
        queryFn: () => data.authors.detail(id!),
        enabled: id !== undefined,
    });
}