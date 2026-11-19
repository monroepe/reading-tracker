import { useReadData } from '@/data/readData';
import { useQuery } from '@tanstack/react-query';


export function useAuthorBooks(id: number | undefined) {
  const data = useReadData();
    return useQuery({
        queryKey: ['authors', id, 'books'],
        queryFn: () => data.authors.books(id!),
        enabled: id !== undefined,
    });
}