import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NewBook } from './useCreateBook';

export function useUpdateBook(id: number) {
    const writes = useWriteData();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: NewBook) => writes.updateBook(id, input),
        onSettled: () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: ['books'] }),
                queryClient.invalidateQueries({ queryKey: ['readings'] }),
                queryClient.invalidateQueries({ queryKey: ['genres'] }),
                queryClient.invalidateQueries({ queryKey: ['tags'] }),
                queryClient.invalidateQueries({ queryKey: ['analytics'] }),
                queryClient.invalidateQueries({ queryKey: ['authors'] }),
            ]),
    });
}