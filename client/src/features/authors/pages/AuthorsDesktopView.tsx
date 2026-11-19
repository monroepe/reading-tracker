
import { useReturnScroll } from '@/hooks/useReturnScroll';
import {
  DataTable,
  type ColumnFilterConfig,
  type FilterOption,
} from '@/components/data-table/DataTable';
import { AuthorBooksPanel } from '../components/AuthorBooksPanel';
import { authorColumns } from '../components/authorColumns';
import { type AuthorFilterKey } from '../hooks/useAuthorListState';
import type { AuthorsViewProps } from "./AuthorsPage";
const GENDER_OPTIONS: FilterOption[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
];
const FILTER_KEY_BY_COLUMN: Record<string, AuthorFilterKey> = {
  name: 'q',
  country: 'country',
  gender: 'gender',
};
export default function AuthorsDesktopView({ filters, hasFilters, setFilter, sorting, onSortingChange, authors, countries, countryOptions, rows }: AuthorsViewProps) {
  const columnFilters = { name: filters.q, country: filters.country, gender: filters.gender };
  const filterConfig: Record<string, ColumnFilterConfig> = {
    name: { type: 'text', placeholder: 'Search by name…' },
    gender: { type: 'select', options: GENDER_OPTIONS },
    ...(countries.data && {
      country: {
        type: 'select',
        options: countryOptions,
      },
    }),
  };
  useReturnScroll(!authors.isPending);
  return <>
    {authors.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    {authors.isError && (<p role="alert" className="text-sm text-destructive">
      {authors.error.message}
    </p>)}
    {authors.isSuccess && (<>
      {/* Keep the table (and its header filters) mounted while filtered, so a
            filter that matches nothing can still be reset. */}
      {(rows.length > 0 || hasFilters) && (<div>
        <DataTable columns={authorColumns} data={rows} sorting={sorting} onSortingChange={onSortingChange} filters={columnFilters} filterConfig={filterConfig} onFilterChange={(columnId, value) => {
          const key = FILTER_KEY_BY_COLUMN[columnId];
          if (key) {
            setFilter(key, value);
          }
        }} renderExpandedRow={(author) => <AuthorBooksPanel authorId={author.id} />} />
      </div>)}
      {rows.length === 0 && (<p className="mt-4 text-sm text-muted-foreground">
        {hasFilters ? 'No authors match your filters.' : 'No authors.'}
      </p>)}
    </>)}
  </>;
}
