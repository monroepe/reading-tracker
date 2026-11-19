import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { useDeleteReading } from './useDeleteReading';
import { useDeleteBook } from '@/features/books/api/useDeleteBook';
vi.mock('@/api/client', () => ({ api: vi.fn() }));
it.each([
  [useDeleteReading, ['readings', 'books', 'authors', 'analytics']],
  [useDeleteBook, ['books', 'authors']],
] as const)('invalidates dependent caches only on successful deletion', async (useDelete, keys) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useDelete(1), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  vi.mocked(api).mockRejectedValueOnce(new Error('Failed'));
  await act(async () => { await expect(result.current.mutateAsync()).rejects.toThrow('Failed'); });
  expect(invalidate).not.toHaveBeenCalled();
  vi.mocked(api).mockResolvedValueOnce(undefined);
  await act(async () => { await result.current.mutateAsync(); });
  expect(invalidate.mock.calls.map(([options]) => options?.queryKey?.[0])).toEqual(keys);
});
