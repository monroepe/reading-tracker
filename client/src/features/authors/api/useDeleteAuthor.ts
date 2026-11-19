import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';

export function useDeleteAuthor(id: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api<void>(`/authors/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['authors', id] });
            return queryClient.invalidateQueries({ queryKey: ['authors'] });
        },
    });
}