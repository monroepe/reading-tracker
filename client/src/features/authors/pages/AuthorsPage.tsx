import { ListPagination } from '@/components/ListPagination';
import { useListPagination } from '@/hooks/useListPagination';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { WriteOnly } from '@/components/WriteOnly';
import { FormLink } from '@/components/FormLink';
import { Button } from '@/components/ui/button';
import { useAuthorCountries, useAuthorList } from '../api/useAuthors';
import { useAuthorListState } from '../hooks/useAuthorListState';
import { lazy, Suspense } from "react";
const DesktopView = lazy(() => import("./AuthorsDesktopView"));
const MobileView = lazy(() => import("./AuthorsMobileView"));
const MOBILE_SORT_FIELDS: readonly string[] = ['name', 'firstName', 'country', 'bookCount'];
function usePageData(hideDemographics: boolean) {
  const pagination = useListPagination();
  const { params, filters, hasFilters, setFilter, clearFilters, sorting, onSortingChange } =
    useAuthorListState(hideDemographics);
  const authors = useAuthorList({ ...params, page: pagination.page, pageSize: pagination.pageSize });
  const countries = useAuthorCountries();
  const countryOptions = (countries.data ?? []).map((country) => ({
    value: country,
    label: country,
  }));
  const sheetFilterCount = [filters.country, filters.gender].filter(Boolean).length;
  const mobileSortValue =
    params.sort && MOBILE_SORT_FIELDS.includes(params.sort)
      ? `${params.sort}:${params.order}`
      : '';
  const handleMobileSortChange = (value: string) => {
    const [id, direction] = value.split(':');
    onSortingChange([{ id, desc: direction === 'desc' }]);
  };
  const rows = authors.data?.data ?? [];
  return { hideDemographics, pagination, params, filters, hasFilters, setFilter, clearFilters, sorting, onSortingChange, authors, countries, countryOptions, sheetFilterCount, mobileSortValue, handleMobileSortChange, rows };
}
export type AuthorsViewProps = ReturnType<typeof usePageData>;
export function AuthorsPage({ hideDemographics = false } = {}) {
  const isDesktop = useIsDesktop();
  const useTable = isDesktop && !hideDemographics;
  const props = usePageData(hideDemographics);
  return <section className={hideDemographics ? 'mx-auto max-w-2xl px-4 py-6 sm:px-6' : 'p-6'}>
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">Authors</h1>
      <div className="flex items-center gap-2">{props.hasFilters && <Button variant="outline" onClick={props.clearFilters}>Clear all filters</Button>}<WriteOnly>
        <Button render={<FormLink to="/authors/new" />} nativeButton={false}>Add author</Button>
      </WriteOnly>
      </div>
    </div>
    <Suspense fallback={<p role="status">Loading list…</p>}>{useTable ? <DesktopView {...props} /> : <MobileView {...props} />}</Suspense>
    <ListPagination query={props.authors} pagination={props.pagination} />
  </section>;
}
