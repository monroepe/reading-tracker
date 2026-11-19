import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NewAuthor } from './useCreateAuthor';

export function useUpdateAuthor(id: number) {
    const writes = useWriteData();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: NewAuthor) => writes.updateAuthor(id, input),
        onSuccess: () => Promise.all([
            queryClient.invalidateQueries({ queryKey: ['authors'] }),
            queryClient.invalidateQueries({ queryKey: ['books'] }),
            queryClient.invalidateQueries({ queryKey: ['readings'] }),
            queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        ]),
    });
}