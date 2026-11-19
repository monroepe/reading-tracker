import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useIsDesktop } from './useIsDesktop';
export function useListPagination() {
  const [params, setParams] = useSearchParams();
  const isDesktop = useIsDesktop();
  const requestedSize = Number(params.get('pageSize'));
  const pageSize = isDesktop && [25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const setPageSize = (size: number) => {
    if (![25, 50, 100].includes(size)) return;
    scrollPending.current = true;
    setParams(previous => {
      const result = new URLSearchParams(previous);
      result.delete('page');
      if (size === 25) result.delete('pageSize'); else result.set('pageSize', String(size));
      return result;
    });
  };
  const value = Number(params.get('page'));
  const page = Number.isSafeInteger(value) && value > 0 ? value : 1;
  const scrollPending = useRef(false);
  const setPage = (next: number, replace = false) => {
    scrollPending.current = !replace;
    setParams(previous => {
      const result = new URLSearchParams(previous);
      if (next === 1) result.delete('page'); else result.set('page', String(next));
      return result;
    }, { replace });
  };
  return { page, pageSize, setPageSize, isDesktop, setPage, consumeScroll: () => { const pending = scrollPending.current; scrollPending.current = false; return pending; } };
}

