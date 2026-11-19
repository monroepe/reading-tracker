import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { User } from '../../api/types';

export const meQueryKey = ['me'] as const;

export function useMe(enabled = true) {
  return useQuery<User | null>({
    enabled,
    queryKey: meQueryKey,
    queryFn: () => api<User>('/auth/me'),
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<User>('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: async (user) => {
      await queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      queryClient.getMutationCache().clear();
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
      queryClient.getMutationCache().clear();
      queryClient.setQueryData<User | null>(meQueryKey, null);
    },
  });
}
