import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useReadingsByGenre } from './useAnalytics';
import { ReadingBreakdownChart } from './ReadingBreakdownChart';

export function GenreBarSection() {
    const [selectedPeriod, setGenreBarYear] = useState('all');
    const { periods: years, year: genreBarYear } = useChartPeriod(selectedPeriod, setGenreBarYear);
    const selectedGenreBarYear = genreBarYear === 'all' ? undefined : parsePeriod(genreBarYear);
    const {
        data: genreBarData,
        isPending: isGenreBarPending,
        isError: isGenreBarError,
        error: genreBarError,
    } = useReadingsByGenre(selectedGenreBarYear);
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by genre (bar)</h2>
                    <p className="text-sm text-muted-foreground">
                        Completed, non-abandoned readings by genre, most-read first.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect
                        value={genreBarYear}
                        onChange={(event) => setGenreBarYear(event.target.value)}
                    >
                        <option value="all">All years</option>
                        {years.map((optionYear) => (
                            <option key={optionYear} value={optionYear}>
                                {periodLabel(optionYear)}
                            </option>
                        ))}
                    </NativeSelect>
                </label>
            </div>

            {isGenreBarPending && <p>Loading analytics…</p>}

            {isGenreBarError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {genreBarError.message}
                </p>
            )}

            {!isGenreBarPending && !isGenreBarError && genreBarData && genreBarData.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed readings.</p>
            )}

            {!isGenreBarPending && !isGenreBarError && genreBarData && genreBarData.length > 0 && (
                <ReadingBreakdownChart
                    data={(genreBarData ?? []).map((item) => ({ ...item, name: item.genre }))}
                    variant="bar"
                />
            )}
        </div>
    );
}
