import { Button } from '@/components/ui/button';
import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { ReadingFormatSection } from '@/features/analytics/ReadingFormatSection';
import { ReadingsPerYearSection } from '@/features/analytics/ReadingsPerYearSection';
import { ReadingMixChart } from '@/features/analytics/ReadingMixChart';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { Link } from 'react-router';
import { ReadingBreakdownChart } from '@/features/analytics/ReadingBreakdownChart';
import { TopAuthorsChart } from '@/features/analytics/TopAuthorsChart';
import {
    useReadingsByCategory,
    useReadingsByGenre,
    useReadingsByTag,
} from '@/features/analytics/useAnalytics';
import { NativeSelect } from '@/components/ui/native-select';

export function LocalAnalyticsPage({ showReadingMix = true }: { showReadingMix?: boolean }) {
    return (
        <section className="space-y-6 p-4">
            <div className="flex flex-wrap justify-between gap-3">
                <h1 className="text-2xl font-semibold">Analytics</h1>
                <Button variant="outline" render={<Link to="/analytics/year-in-review" />} nativeButton={false}>Year in Review</Button>
            </div>
            {showReadingMix && <ReadingMixChart />}
            <TopAuthorsChart />
            <ReadingFormatSection />

            <ReadingsPerYearSection color="var(--chart-3)" />

            <CategoryBreakdown />
            <GenreBreakdown />
            <TagBreakdown />
        </section>
    );
}

const CategoryBreakdown = () => <AdditionalBreakdown kind="category" useBreakdown={useReadingsByCategory} />;
const GenreBreakdown = () => <AdditionalBreakdown kind="genre" useBreakdown={useReadingsByGenre} />;
const TagBreakdown = () => <AdditionalBreakdown kind="tag" useBreakdown={useReadingsByTag} />;

function AdditionalBreakdown({ kind, useBreakdown }: { kind: 'category' | 'genre' | 'tag'; useBreakdown: typeof useReadingsByCategory | typeof useReadingsByGenre | typeof useReadingsByTag }) {
    const [selectedPeriod, setYear] = useState('all');
    const { periods: years, year } = useChartPeriod(selectedPeriod, setYear);
    const period = year === 'all' ? undefined : parsePeriod(year);
    const result = useBreakdown(period);
    const query = { ...result, data: result.data?.map(item => ({ name: 'category' in item ? item.category : 'genre' in item ? item.genre : item.tag, count: item.count })) };
    return <div className="rounded-lg border p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="mb-1 text-lg font-medium">Readings by {kind}</h2>
                <p className="text-sm text-muted-foreground">Completed, non-abandoned readings{kind === 'tag' ? ' using current book tags. A reading can have multiple tags.' : '.'}</p></div>
            <label className="flex items-center gap-2 text-sm">Finish year
                <NativeSelect aria-label={`${kind} finish year`} value={year} onChange={event => setYear(event.target.value)}>
                    <option value="all">All years</option>
                    {years.map(value => <option key={value} value={value}>{periodLabel(value)}</option>)}
                </NativeSelect>
            </label>
        </div>
        {query.isPending && <p>Loading analytics…</p>}
        {query.isError && <p role="alert" className="text-sm text-destructive">Failed to load analytics: {query.error.message}</p>}
        {query.data && (query.data.length === 0 && kind === 'tag'
            ? <p className="text-sm text-muted-foreground">No tagged completed readings.</p>
            : <ReadingBreakdownChart data={query.data} variant={kind === 'category' ? 'doughnut' : 'bar'}
                color={kind === 'genre' ? 'var(--chart-4)' : 'var(--chart-2)'} />)}
    </div>;
}
