
import { useReturnScroll } from '@/hooks/useReturnScroll';
import type { Category, Format } from '@/api/types';
import {
  DataTable,
  type ColumnFilterConfig,
  type FilterOption,
} from '@/components/data-table/DataTable';
import { AuthorCombobox } from '@/features/authors/components/AuthorCombobox';
import { readingColumns } from '../components/readingColumns';
import { type ReadingFilterKey } from '../hooks/useReadingListState';
import type { ReadingsViewProps } from "./ReadingsPage";
const pre2022Columns = readingColumns.filter((column) => {
  const id = column.id ?? ('accessorKey' in column ? column.accessorKey : undefined);
  return id !== 'finishedOn' && id !== 'days' && id !== 'pagesPerDay';
});
const FORMATS: Format[] = ['Print', 'Kindle', 'Audiobook', 'Graphic Novel'];
const CATEGORIES: Category[] = ['Fiction', 'Non-fiction'];
const FORMAT_OPTIONS: FilterOption[] = FORMATS.map((f) => ({ value: f, label: f }));
const CATEGORY_OPTIONS: FilterOption[] = CATEGORIES.map((c) => ({ value: c, label: c }));
const FILTER_KEY_BY_COLUMN: Record<string, ReadingFilterKey> = {
  title: 'q',
  author: 'authorId',
  genre: 'genreId',
  category: 'category',
  format: 'format',
};
export default function ReadingsDesktopView({ filters, hasFilters, setFilter, sorting, onSortingChange, year, readings, genres, selectedAuthor, genreOptions, rows }: ReadingsViewProps) {
  const columnFilters = {
    title: filters.q,
    author: filters.authorId,
    genre: filters.genreId,
    category: filters.category,
    format: filters.format,
  };
  const filterConfig: Record<string, ColumnFilterConfig> = {
    title: { type: 'text', placeholder: 'Search by title…' },
    author: {
      type: 'custom',
      render: ({ onChange }) => (
        <AuthorCombobox
          value={selectedAuthor.data ?? null}
          onChange={(author) => onChange(author ? String(author.id) : '')}
        />
      ),
    },
    category: { type: 'select', options: CATEGORY_OPTIONS },
    format: { type: 'select', options: FORMAT_OPTIONS },
    ...(genres.data && {
      genre: {
        type: 'select',
        options: genreOptions,
      },
    }),
  };
  useReturnScroll(!readings.isPending);
  return <>
    {readings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    {readings.isError && (<p role="alert" className="text-sm text-destructive">
      {readings.error.message}
    </p>)}
    {readings.isSuccess && (<>
      {/* Keep the table (and its header filters) mounted while filtered, so a
            filter that matches nothing can still be reset. */}
      {(rows.length > 0 || hasFilters) && (<>
        {<div>
          <DataTable columns={year === 'pre-2022' ? pre2022Columns : readingColumns} data={rows} sorting={sorting} onSortingChange={onSortingChange} filters={columnFilters} filterConfig={filterConfig} onFilterChange={(columnId, value) => {
            const key = FILTER_KEY_BY_COLUMN[columnId];
            if (key) {
              setFilter(key, value);
            }
          }} />
        </div>}
      </>)}
      {rows.length === 0 && (<p className="mt-4 text-sm text-muted-foreground">
        {hasFilters ? 'No readings match your filters.' : 'No readings.'}
      </p>)}
    </>)}
  </>;
}
