import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useReadingControls } from '@/features/auth/useReadingControls';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { WriteOnly } from '@/components/WriteOnly';
import { periodLabel, type ReadingPeriod } from '@/lib/readingPeriod';
import { FormLink } from '@/components/FormLink';
import {
  type FilterOption,
} from '@/components/data-table/DataTable';
import { Button } from '@/components/ui/button';
import { useAuthor } from '@/features/authors/api/useAuthor';
import { useGenres } from '@/features/genres/useGenres';
import { useReadingList } from '../api/useReadings';
import { useReadingListState } from '../hooks/useReadingListState';
import { lazy, Suspense } from "react";
const DesktopView = lazy(() => import("./ReadingsDesktopView"));
const MobileView = lazy(() => import("./ReadingsMobileView"));
const currentYear = new Date().getFullYear();
const MOBILE_SORT_FIELDS = ['title', 'genre', 'format', 'rating'];
function usePageData(defaultYear: number) {
  const { params, filters, hasFilters, setFilter, clearFilters, sorting, onSortingChange } =
    useReadingListState();
  const { pre2022 } = useReadingControls();
  const [search, setSearch] = useSearchParams();
  const restricted = !pre2022 && (params.year === 'pre-2022' || (typeof params.year === 'number' && params.year < 2022));
  const year = restricted ? defaultYear : params.year ?? defaultYear;
  useEffect(() => {
    if (!restricted) return;
    const updated = new URLSearchParams(search);
    updated.set('year', String(defaultYear));
    setSearch(updated, { replace: true });
  }, [defaultYear, restricted, search, setSearch]);
  const readings = useReadingList({ ...params, year });
  const genres = useGenres();
  const selectedAuthor = useAuthor(params.authorId);
  const genreOptions: FilterOption[] = (genres.data ?? []).map((genre) => ({
    value: String(genre.id),
    label: genre.name,
  }));
  const sheetFilterCount = [filters.genreId, filters.category, filters.format].filter(
    Boolean,
  ).length;
  const mobileSortValue =
    params.sort && MOBILE_SORT_FIELDS.includes(params.sort)
      ? `${params.sort}:${params.order}`
      : '';
  const handleMobileSortChange = (value: string) => {
    const [id, direction] = value.split(':');
    onSortingChange([{ id, desc: direction === 'desc' }]);
  };
  const setYear = (next: ReadingPeriod) => setFilter('year', String(next));
  const rows = readings.data?.data ?? [];
  return { pre2022, params, filters, hasFilters, setFilter, clearFilters, sorting, onSortingChange, year, readings, genres, selectedAuthor, genreOptions, sheetFilterCount, mobileSortValue, handleMobileSortChange, setYear, rows };
}
export type ReadingsViewProps = ReturnType<typeof usePageData>;
export function ReadingsPage({ preview = false, defaultYear = currentYear } = {}) {
  const isDesktop = useIsDesktop();
  const props = usePageData(defaultYear);
  return <section className="p-6">
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" disabled={props.year === 'pre-2022' || (!props.pre2022 && props.year <= 2022)} onClick={() => props.setYear(props.year === 'pre-2022' || props.year <= 2022 ? 'pre-2022' : props.year - 1)} aria-label="Previous year">←</Button>
        <h1 className="text-2xl font-semibold">{periodLabel(props.year)}</h1>
        <Button variant="outline" size="icon" disabled={props.year !== 'pre-2022' && props.year >= new Date().getFullYear()} onClick={() => props.setYear(props.year === 'pre-2022' ? 2022 : props.year + 1)} aria-label="Next year">→</Button>
      </div>
      <div className="flex items-center gap-2">{props.hasFilters && <Button variant="outline" onClick={props.clearFilters}>Clear all filters</Button>}{preview ? <Button render={<FormLink to="/readings/new" />} nativeButton={false}>Try logging a reading</Button> : <WriteOnly>
        <Button render={<FormLink to="/readings/new" />} nativeButton={false}>Add reading</Button>
      </WriteOnly>}
      </div>
    </div>
    <Suspense fallback={<p role="status">Loading list…</p>}>{isDesktop ? <DesktopView {...props} /> : <MobileView {...props} />}</Suspense>
  </section>;
}
