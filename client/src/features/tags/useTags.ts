import { useReadData } from '@/data/readData';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Tag } from '@/api/types';

// The book filter needs the names for arbitrary tag IDs stored in its URL.
export function useTags() {
  const data = useReadData();
  return useQuery({
    queryKey: ['tags', 'all'],
    queryFn: async ({ signal }) => {
      const tags: Tag[] = [];
      let page = 1;
      while (true) {
        const result = await data.tags.list({ page, pageSize: 100 }, { signal });
        tags.push(...result.data);
        if (tags.length >= result.total || result.data.length === 0) return tags;
        page++;
      }
    },
  });
}

export function useTagSearch(q: string) {
  const data = useReadData();
  return useInfiniteQuery({
    queryKey: ['tags', 'search', q],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => data.tags.list({ q, page: pageParam, pageSize: 50 }, { signal }),
    getNextPageParam: (last) => last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}
