import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useDeleteBook(id: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api<void>(`/books/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['books', id] });
            return Promise.all(['books', 'authors'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))); 
        },
    });
}