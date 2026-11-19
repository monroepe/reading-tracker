
import { useReturnScroll } from '@/hooks/useReturnScroll';
import {
  type FilterOption,
} from '@/components/data-table/DataTable';
import { MobileFilterSheet, MobileFilterSelect } from '@/components/MobileFilterSheet';
import { MobileListControls, type SortOption } from '@/components/MobileListControls';
import { TagPicker } from '@/features/tags/TagPicker';
import { BookCard } from '../components/BookCard';
import type { BooksViewProps } from "./BooksPage";
const CATEGORY_OPTIONS: FilterOption[] = [
  { value: 'Fiction', label: 'Fiction' },
  { value: 'Non-fiction', label: 'Non-fiction' },
];
const MOBILE_SORT_OPTIONS: SortOption[] = [
  { value: 'rating:desc', label: 'Rating: High to low' },
  { value: 'rating:asc', label: 'Rating: Low to high' },
  { value: 'title:asc', label: 'Title: A-Z' },
  { value: 'title:desc', label: 'Title: Z-A' },
  { value: 'author:asc', label: 'Author: A-Z' },
  { value: 'author:desc', label: 'Author: Z-A' },
  { value: 'genre:asc', label: 'Genre: A-Z' },
  { value: 'genre:desc', label: 'Genre: Z-A' },
];
export default function BooksMobileView({ filters, hasFilters, setFilter, books, selectedTags, handleTagsChange, genreOptions, mobileFilterCount, mobileSortValue, handleMobileSortChange, rows }: BooksViewProps) {
  useReturnScroll(!books.isPending);
  return <>
    {books.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    {books.isError && (<p role="alert" className="text-sm text-destructive">
      {books.error.message}
    </p>)}
    {books.isSuccess && (<>
      {(rows.length > 0 || hasFilters) && (<>
        {<div>
          <MobileListControls searchLabel="Search books" searchPlaceholder="Search by title or author…" searchValue={filters.search} onSearchChange={(value) => setFilter('search', value)}>
            <MobileFilterSheet activeCount={mobileFilterCount} title="Filters & sort">
              <MobileFilterSelect label="Sort by" value={mobileSortValue} options={MOBILE_SORT_OPTIONS} onChange={handleMobileSortChange} showAll={false} placeholder="Default" />
              <MobileFilterSelect label="Genre" value={filters.genreId} options={genreOptions} onChange={(value) => setFilter('genreId', value)} />
              <MobileFilterSelect label="Category" value={filters.category} options={CATEGORY_OPTIONS} onChange={(value) => setFilter('category', value)} />
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Tags</span>
                <TagPicker allowCreate={false} value={selectedTags} onChange={handleTagsChange} placeholder="Filter by tags…" />
              </div>
            </MobileFilterSheet>
          </MobileListControls>
        </div>}
      </>)}
      {rows.length > 0 && (<div className="space-y-3">
        {rows.map((book) => (<BookCard key={book.id} book={book} />))}
      </div>)}
      {rows.length === 0 && (<p className="mt-4 text-sm text-muted-foreground">
        {hasFilters ? 'No books match your filters.' : 'No books.'}
      </p>)}
    </>)}
  </>;
}
