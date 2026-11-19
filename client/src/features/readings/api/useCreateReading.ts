import type { Format } from '@/api/types';
import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface NewReading {
  startedOn: string;
  format: Format;
  bookId: number;
}

export function useCreateReading() {
  const writes = useWriteData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewReading) => writes.createReading(input),
    onSuccess: () => Promise.all(['readings', 'books', 'authors', 'analytics'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))),
  });
}
