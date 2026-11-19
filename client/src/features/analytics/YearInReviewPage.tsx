import { useAvailablePeriods } from './useAvailablePeriods';
import { useReadingControls } from '@/features/auth/useReadingControls';
import { parsePeriod, periodLabel, type ReadingPeriod } from '@/lib/readingPeriod';
import { formatAuthor } from '@/lib/format';
import { useState, type ReactNode } from 'react';
import { Star } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ReadingBreakdownChart } from './ReadingBreakdownChart';
import { useYearInReview } from './useAnalytics';

import { QueryError } from './QueryError';

export function YearInReviewLaunch() {
    const { query: years, periods } = useAvailablePeriods();
    if (years.isPending) return <p role="status" className="p-6">Finding your latest reading year…</p>;
    if (years.isError) return <div className="p-6"><QueryError message={years.error.message} retry={() => { void years.refetch(); }} /></div>;
    if (!periods.length) return <section className="space-y-4 p-6">
        <Link to="/analytics" className="underline">Back to Analytics</Link>
        <p>No completed readings.</p>
    </section>;
    return <Navigate to={`/analytics/year-in-review/${periods[0]}`} replace />;
}

export function YearInReviewPage() {
    const { year: yearParam } = useParams();
    const year = parsePeriod(yearParam ?? '');
    const { query, periods } = useAvailablePeriods();
    if (query.isPending || query.isError) return <YearInReviewLaunch />;
    if (year === undefined || !periods.includes(year)) return <Navigate to="/analytics/year-in-review" replace />;
    return <YearInReviewReport year={year} years={periods} />;
}

function RankingSection({ title, included, onToggle, children }: {
    title: string; included: boolean | undefined; onToggle: () => void; children: ReactNode;
}) {
    return <section aria-label={title} className="space-y-4 rounded-lg border p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-medium">{title}</h2>
            {included !== undefined && <Button type="button" variant={included ? 'default' : 'outline'} aria-pressed={included} onClick={onToggle}>
                Include graphic novels
            </Button>}
        </div>
        {children}
    </section>;
}

function YearInReviewReport({ year, years }: { year: ReadingPeriod; years: ReadingPeriod[] }) {
    const { graphicNovels } = useReadingControls();
    const navigate = useNavigate();
    const [includeBooks, setIncludeBooks] = useState(false);
    const [includeAuthors, setIncludeAuthors] = useState(false);
    const review = useYearInReview(year, {
        includeGraphicNovelsInBooks: !graphicNovels || includeBooks,
        includeGraphicNovelsInAuthors: !graphicNovels || includeAuthors,
    });
    const { data } = review;
    const status = review.isPending ? <p role="status">Loading review…</p> : review.isError ?
        <QueryError message={`Failed to load review: ${review.error.message}`} retry={() => { void review.refetch(); }} /> : null;

    return <section className="space-y-6 p-6" aria-busy={review.isFetching}>
        <Link to="/analytics" className="text-sm underline">Back to Analytics</Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold">{periodLabel(year)} in books</h1>
                <p className="text-sm text-muted-foreground">Your Year in Review · Completed readings by finish year</p>
            </div>
            <label className="flex items-center gap-2 text-sm">Period
                <NativeSelect value={year} onChange={(event) => { void navigate(`/analytics/year-in-review/${event.target.value}`); }}>
                    {years.map((option) => <option key={option} value={option}>{periodLabel(option)}</option>)}
                </NativeSelect>
            </label>
        </div>
        {review.isFetching && !review.isPending && <p role="status" className="text-sm text-muted-foreground">Updating review…</p>}
        {data && !review.isError && <div className="rounded-lg border p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <p className="text-3xl font-semibold tabular-nums">{data.total}</p>
                    <p className="text-sm text-muted-foreground">Completed readings · All formats</p>
                </div>
                <div>
                    <p className="text-3xl font-semibold tabular-nums">{data.totalPages.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Pages read · All formats</p>
                </div>
                {[
                    { label: 'Top tag', item: data.byTag[0], name: data.byTag[0]?.tag },
                    { label: 'Top genre', item: data.byGenre[0], name: data.byGenre[0]?.genre },
                ].map(({ label, item, name }) => <div key={label} className="min-w-0">
                    <p className="break-words text-3xl font-semibold">{name ?? 'None'}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    {item && <p className="text-sm text-muted-foreground">{item.count} completed {item.count === 1 ? 'reading' : 'readings'}</p>}
                </div>)}
            </div>
            {data.total === 0 && <p className="mt-3">No completed readings in {periodLabel(year)}.</p>}
        </div>}
        <RankingSection title="Top 10 rated books" included={graphicNovels ? includeBooks : undefined} onToggle={() => setIncludeBooks((value) => !value)}>
            {status ?? (data && (data.topBooks.length === 0 ? <p>No rated books for these settings.</p> :
                <ol className="divide-y">
                    {data.topBooks.map((book, index) => <li key={book.bookId} className="flex items-center gap-4 py-3">
                        <span className="w-6 shrink-0 text-sm text-muted-foreground">{index + 1}.</span>
                        <div className="min-w-0 flex-1 break-words">
                            <Link to={`/books/${book.bookId}`} className="font-medium hover:underline">{book.title}</Link>
                            <p className="text-sm text-muted-foreground">{formatAuthor(book)}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums" aria-label={`${book.rating} out of 10 stars`}>
                            {book.rating}<Star className="size-4 fill-current text-amber-500" aria-hidden="true" />
                        </span>
                    </li>)}
                </ol>))}
        </RankingSection>
        <RankingSection title="Top 10 most-read authors" included={graphicNovels ? includeAuthors : undefined} onToggle={() => setIncludeAuthors((value) => !value)}>
            {status ?? (data && (data.topAuthors.length === 0 ? <p>No completed books for these settings.</p> :
                <ol className="divide-y">
                    {data.topAuthors.map((author, index) => <li key={author.authorId} className="flex items-center gap-4 py-3">
                        <span className="w-6 shrink-0 text-sm text-muted-foreground">{index + 1}.</span>
                        <Link to={`/authors/${author.authorId}`} className="min-w-0 flex-1 break-words font-medium hover:underline">
                            {formatAuthor(author)}
                        </Link>
                        <span className="shrink-0 tabular-nums">{author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}</span>
                    </li>)}
                </ol>))}
        </RankingSection>
        {status ?? (data && <>
            <p className="text-sm text-muted-foreground">Breakdowns include all formats. Tags use your current personal assignments; a completed reading can have multiple tags.</p>
            {[
                { title: 'Readings by format', variant: 'doughnut' as const, items: data.byFormat.map((item) => ({ name: item.format, count: item.count })) },
                { title: 'Readings by category', variant: 'doughnut' as const, items: data.byCategory.map((item) => ({ name: item.category, count: item.count })) },
                { title: 'Readings by genre', variant: 'bar' as const, items: data.byGenre.map((item) => ({ name: item.genre, count: item.count })) },
                { title: 'Readings by tag', variant: 'bar' as const, items: data.byTag.map((item) => ({ name: item.tag, count: item.count })) },
            ].map(({ title, variant, items }) => <section key={title} aria-label={title} className="space-y-4 rounded-lg border p-6">
                <h2 className="text-lg font-medium">{title}</h2>
                {items.length === 0 ? <p className="text-sm text-muted-foreground">No matching completed readings.</p> :
                    <ReadingBreakdownChart data={items} variant={variant} color={title === 'Readings by tag' ? 'var(--chart-2)' : undefined} />}
            </section>)}
        </>)}
    </section>;
}
