
import { useReturnScroll } from '@/hooks/useReturnScroll';
import {
  type FilterOption,
} from '@/components/data-table/DataTable';
import { MobileListControls, type SortOption } from '@/components/MobileListControls';
import { MobileFilterSheet, MobileFilterSelect } from '@/components/MobileFilterSheet';
import { AuthorCard } from '../components/AuthorCard';
import type { AuthorsViewProps } from "./AuthorsPage";
const GENDER_OPTIONS: FilterOption[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
];
const MOBILE_SORT_OPTIONS: SortOption[] = [
  { value: 'name:asc', label: 'Last name: A-Z' },
  { value: 'name:desc', label: 'Last name: Z-A' },
  { value: 'firstName:asc', label: 'First name: A-Z' },
  { value: 'firstName:desc', label: 'First name: Z-A' },
  { value: 'country:asc', label: 'Country: A-Z' },
  { value: 'country:desc', label: 'Country: Z-A' },
  { value: 'bookCount:desc', label: 'Books: most first' },
  { value: 'bookCount:asc', label: 'Books: fewest first' },
];
const demoSortOptions = MOBILE_SORT_OPTIONS.filter(option => !option.value.startsWith('country:'));
export default function AuthorsMobileView({ hideDemographics, filters, hasFilters, setFilter, authors, countryOptions, sheetFilterCount, mobileSortValue, handleMobileSortChange, rows }: AuthorsViewProps) {
  useReturnScroll(!authors.isPending);
  return <>
    {authors.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    {authors.isError && (<p role="alert" className="text-sm text-destructive">
      {authors.error.message}
    </p>)}
    {authors.isSuccess && (<>
      {(rows.length > 0 || hasFilters) && (<div>
        <MobileListControls searchLabel="Search authors" searchPlaceholder="Search by name…" searchValue={filters.q} onSearchChange={(value) => setFilter('q', value)}
          sortOptions={hideDemographics ? demoSortOptions : undefined} sortValue={mobileSortValue} onSortChange={handleMobileSortChange}>
          {!hideDemographics && <MobileFilterSheet activeCount={sheetFilterCount} title="Filters & sort">
            <MobileFilterSelect label="Sort by" value={mobileSortValue} options={MOBILE_SORT_OPTIONS} onChange={handleMobileSortChange} showAll={false} placeholder="Default" />
            <MobileFilterSelect label="Country" value={filters.country} options={countryOptions} onChange={(value) => setFilter('country', value)} />
            <MobileFilterSelect label="Gender" value={filters.gender} options={GENDER_OPTIONS} onChange={(value) => setFilter('gender', value)} />
          </MobileFilterSheet>}
        </MobileListControls>
      </div>)}
      {rows.length > 0 && (hideDemographics ? (
        <ul className="divide-y rounded-lg border">
          {rows.map((author) => <li key={author.id}><AuthorCard author={author} hideDemographics /></li>)}
        </ul>
      ) : (
        <div className="space-y-3">
          {rows.map((author) => <AuthorCard key={author.id} author={author} />)}
        </div>
      ))}
      {rows.length === 0 && (<p className="mt-4 text-sm text-muted-foreground">
        {hasFilters ? 'No authors match your filters.' : 'No authors.'}
      </p>)}
    </>)}
  </>;
}
