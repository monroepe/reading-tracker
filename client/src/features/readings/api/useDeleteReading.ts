import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';

export function useDeleteReading(id: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => api<void>(`/readings/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.removeQueries({ queryKey: ['readings', id] });
            return Promise.all(['readings', 'books', 'authors', 'analytics'].map(key => queryClient.invalidateQueries({ queryKey: [key] }))); 
        },
    });
}