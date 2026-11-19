
import { useReturnScroll } from '@/hooks/useReturnScroll';
import {
  DataTable,
  type ColumnFilterConfig,
  type FilterOption,
} from '@/components/data-table/DataTable';
import { AuthorCombobox } from '@/features/authors/components/AuthorCombobox';
import { TagPicker } from '@/features/tags/TagPicker';
import { BookReadingsPanel } from '../components/BookReadingsPanel';
import { bookColumns } from '../components/bookColumns';
import { type BookFilterKey } from '../hooks/useBookListState';
import type { BooksViewProps } from "./BooksPage";
const CATEGORY_OPTIONS: FilterOption[] = [
  { value: 'Fiction', label: 'Fiction' },
  { value: 'Non-fiction', label: 'Non-fiction' },
];
const FILTER_KEY_BY_COLUMN: Record<string, BookFilterKey> = {
  title: 'q',
  author: 'authorId',
  genre: 'genreId',
  category: 'category',
};
export default function BooksDesktopView({ filters, hasFilters, setFilter, sorting, onSortingChange, books, genres, selectedAuthor, selectedTags, handleTagsChange, rows }: BooksViewProps) {
  const columnFilters = {
    title: filters.q,
    author: filters.authorId,
    genre: filters.genreId,
    category: filters.category,
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
    ...(genres.data && {
      genre: {
        type: 'select',
        options: genres.data.map((genre) => ({
          value: String(genre.id),
          label: genre.name,
        })),
      },
    }),
  };
  useReturnScroll(!books.isPending);
  return <>
    {<div className="mb-4 max-w-md">
      <TagPicker allowCreate={false} value={selectedTags} onChange={handleTagsChange} placeholder="Filter by tags…" />
    </div>}
    {books.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
    {books.isError && (<p role="alert" className="text-sm text-destructive">
      {books.error.message}
    </p>)}
    {books.isSuccess && (<>
      {(rows.length > 0 || hasFilters) && (<>
        {<div>
          <DataTable columns={bookColumns} data={rows} sorting={sorting} onSortingChange={onSortingChange} filters={columnFilters} filterConfig={filterConfig} onFilterChange={(columnId, value) => {
            const key = FILTER_KEY_BY_COLUMN[columnId];
            if (key) {
              setFilter(key, value);
            }
          }} renderExpandedRow={(book) => <BookReadingsPanel bookId={book.id} />} />
        </div>}
      </>)}
      {rows.length === 0 && (<p className="mt-4 text-sm text-muted-foreground">
        {hasFilters ? 'No books match your filters.' : 'No books.'}
      </p>)}
    </>)}
  </>;
}
