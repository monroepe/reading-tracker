import { ListPagination } from '@/components/ListPagination';
import { useListPagination } from '@/hooks/useListPagination';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { WriteOnly } from '@/components/WriteOnly';
import { FormLink } from '@/components/FormLink';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/features/authors/api/useAuthor';
import { useGenres } from '@/features/genres/useGenres';
import type { TagChoice } from '@/features/tags/TagPicker';
import { useTags } from '@/features/tags/useTags';
import { useBookListState } from '../hooks/useBookListState';
import { useBookList } from '../api/useBooks';
import { lazy, Suspense } from "react";
const DesktopView = lazy(() => import("./BooksDesktopView"));
const MobileView = lazy(() => import("./BooksMobileView"));
const MOBILE_SORT_FIELDS: readonly string[] = ['title', 'author', 'genre', 'rating'];
function usePageData() {
  const pagination = useListPagination();
  const {
    params,
    filters,
    hasFilters,
    setFilter,
    clearFilters,
    sorting,
    onSortingChange,
    tagIds,
    setTagIds,
  } = useBookListState();
  const books = useBookList({ ...params, page: pagination.page, pageSize: pagination.pageSize });
  const genres = useGenres();
  const tags = useTags();
  const selectedAuthor = useAuthor(params.authorId);
  const selectedTags: TagChoice[] = (tags.data ?? []).filter((tag) =>
    tagIds.includes(tag.id),
  );
  const handleTagsChange = (selected: TagChoice[]) => {
    setTagIds(
      selected.filter((tag): tag is { id: number; name: string } => 'id' in tag)
        .map((tag) => tag.id),
    );
  };
  const genreOptions = (genres.data ?? []).map((genre) => ({
    value: String(genre.id),
    label: genre.name,
  }));
  const mobileFilterCount =
    (filters.genreId ? 1 : 0) + (filters.category ? 1 : 0) + tagIds.length;
  const mobileSortValue =
    params.sort && MOBILE_SORT_FIELDS.includes(params.sort)
      ? `${params.sort}:${params.order}`
      : '';
  const handleMobileSortChange = (value: string) => {
    const [id, direction] = value.split(':');
    onSortingChange([{ id, desc: direction === 'desc' }]);
  };
  const rows = books.data?.data ?? [];
  return { pagination, params, filters, hasFilters, setFilter, clearFilters, sorting, onSortingChange, tagIds, setTagIds, books, genres, tags, selectedAuthor, selectedTags, handleTagsChange, genreOptions, mobileFilterCount, mobileSortValue, handleMobileSortChange, rows };
}
export type BooksViewProps = ReturnType<typeof usePageData>;
export function BooksPage({ preview = false } = {}) {
  const isDesktop = useIsDesktop();
  const props = usePageData();
  return <section className="p-6">
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">Books</h1>
      <div className="flex items-center gap-2">{props.hasFilters && <Button variant="outline" onClick={props.clearFilters}>Clear all filters</Button>}{preview ? <Button render={<FormLink to="/books/new" />} nativeButton={false}>Try adding a book</Button> : <WriteOnly>
        <Button render={<FormLink to="/books/new" />} nativeButton={false}>Add book</Button>
      </WriteOnly>}
      </div>
    </div>
    <Suspense fallback={<p role="status">Loading list…</p>}>{isDesktop ? <DesktopView {...props} /> : <MobileView {...props} />}</Suspense>
    <ListPagination query={props.books} pagination={props.pagination} />
  </section>;
}
