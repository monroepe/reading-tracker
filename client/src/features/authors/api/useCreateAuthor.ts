import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface NewAuthor {
  firstName: string;
  middleName: string;
  lastName: string;
  country?: string | null;
  countryIds?: number[];
  gender: string | null;
}

export function useCreateAuthor() {
  const writes = useWriteData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewAuthor) => writes.createAuthor(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['authors'] }),
  });
}
