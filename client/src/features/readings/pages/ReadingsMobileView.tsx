
import { useReturnScroll } from '@/hooks/useReturnScroll';
import type { Category, Format } from '@/api/types';
import {
  type FilterOption,
} from '@/components/data-table/DataTable';
import { MobileFilterSelect, MobileFilterSheet } from '@/components/MobileFilterSheet';
import { MobileListControls, type SortOption } from '@/components/MobileListControls';
import { ReadingCard } from '../components/ReadingCard';
import type { ReadingsViewProps } from "./ReadingsPage";
const FORMATS: Format[] = ['Print', 'Kindle', 'Audiobook', 'Graphic Novel'];
const CATEGORIES: Category[] = ['Fiction', 'Non-fiction'];
const FORMAT_OPTIONS: FilterOption[] = FORMATS.map((f) => ({ value: f, label: f }));
const CATEGORY_OPTIONS: FilterOption[] = CATEGORIES.map((c) => ({ value: c, label: c }));
const MOBILE_SORT_OPTIONS: SortOption[] = [
  { value: 'rating:desc', label: 'Rating: High to low' },
  { value: 'rating:asc', label: 'Rating: Low to high' },
  { value: 'title:asc', label: 'Title: A-Z' },
  { value: 'title:desc', label: 'Title: Z-A' },
  { value: 'genre:asc', label: 'Genre: A-Z' },
  { value: 'genre:desc', label: 'Genre: Z-A' },
  { value: 'format:asc', label: 'Format: A-Z' },
  { value: 'format:desc', label: 'Format: Z-A' },
];
export default function ReadingsMobileView({ filters, hasFilters, setFilter, readings, genreOptions, sheetFilterCount, mobileSortValue, handleMobileSortChange, rows }: ReadingsViewProps) {
  useReturnScroll(!readings.isPending);
  return <>
    {readings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    {readings.isError && (<p role="alert" className="text-sm text-destructive">
      {readings.error.message}
    </p>)}
    {readings.isSuccess && (<>
      {(rows.length > 0 || hasFilters) && (<>
        {<div>
          <MobileListControls searchLabel="Search title" searchPlaceholder="Search by title…" searchValue={filters.q} onSearchChange={(value) => setFilter('q', value)}>
            <MobileFilterSheet activeCount={sheetFilterCount} title="Filters & sort">
              <MobileFilterSelect label="Sort by" value={mobileSortValue} options={MOBILE_SORT_OPTIONS} onChange={handleMobileSortChange} showAll={false} placeholder="Default" />
              <MobileFilterSelect label="Genre" value={filters.genreId} options={genreOptions} onChange={(value) => setFilter('genreId', value)} />
              <MobileFilterSelect label="Category" value={filters.category} options={CATEGORY_OPTIONS} onChange={(value) => setFilter('category', value)} />
              <MobileFilterSelect label="Format" value={filters.format} options={FORMAT_OPTIONS} onChange={(value) => setFilter('format', value)} />
            </MobileFilterSheet>
          </MobileListControls>
        </div>}
        {<div className="space-y-3">
          {rows.map((reading) => (<ReadingCard key={reading.id} reading={reading} />))}
        </div>}
      </>)}
      {rows.length === 0 && (<p className="mt-4 text-sm text-muted-foreground">
        {hasFilters ? 'No readings match your filters.' : 'No readings.'}
      </p>)}
    </>)}
  </>;
}
