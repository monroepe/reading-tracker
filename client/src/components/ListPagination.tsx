import { useEffect } from 'react';
import { useListPagination } from '@/hooks/useListPagination';
import { Button } from '@/components/ui/button';

export function ListPagination({ query, pagination }: {
  query: { data?: { total: number; page: number; pageSize: number }; isFetching: boolean; isError: boolean; isPlaceholderData: boolean };
  pagination: ReturnType<typeof useListPagination>;
}) {
  const { data, isFetching, isError, isPlaceholderData } = query;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? pagination.pageSize)));
  useEffect(() => {
    if (!data || isFetching || isError || isPlaceholderData) return;
    if (pagination.page > pages) { pagination.setPage(pages, true); return; }
    if (pagination.consumeScroll()) {
      requestAnimationFrame(() => document.querySelector('main h1, section h1')?.scrollIntoView?.({ block: 'start' }));
    }
  }, [data, isFetching, isError, isPlaceholderData, pages, pagination]);
  if (!data || isError || !data.total) return null;
  return <nav aria-label="List pagination" className="mt-4 flex flex-nowrap items-center justify-between gap-2 whitespace-nowrap md:justify-start md:gap-3">
    {pagination.isDesktop && <span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}</span>}
    <Button className="shrink-0" variant="outline" disabled={isFetching || pagination.page <= 1} onClick={() => pagination.setPage(pagination.page - 1)}>Previous</Button>
    <label className="flex items-center gap-1">Page <select aria-label="Page" disabled={isFetching} value={pagination.page} onChange={event => pagination.setPage(Number(event.target.value))}>
      {Array.from({ length: pages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
    </select> of {pages}</label>
    <Button className="shrink-0" variant="outline" disabled={isFetching || pagination.page >= pages} onClick={() => pagination.setPage(pagination.page + 1)}>Next</Button>
    {pagination.isDesktop && <label className="flex items-center gap-1">Per page <select aria-label="Records per page" value={pagination.pageSize} disabled={isFetching} onChange={event => pagination.setPageSize(Number(event.target.value))}>
      {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
    </select></label>}
  </nav>;
}
