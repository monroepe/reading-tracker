import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useReadingsByTag } from './useAnalytics';
import { ReadingBreakdownChart } from './ReadingBreakdownChart';

export function TagBarSection() {
    const [selectedPeriod, setTagBarYear] = useState('all');
    const { periods: years, year: tagBarYear } = useChartPeriod(selectedPeriod, setTagBarYear);
    const selectedTagBarYear = tagBarYear === 'all' ? undefined : parsePeriod(tagBarYear);
    const {
        data: tagBarData,
        isPending: isTagBarPending,
        isError: isTagBarError,
        error: tagBarError,
    } = useReadingsByTag(selectedTagBarYear);
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by tag (bar)</h2>
                    <p className="text-sm text-muted-foreground">
                        Completed, non-abandoned readings by finish year and your current personal tags, most-read first. A reading can have multiple tags.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect
                        value={tagBarYear}
                        onChange={(event) => setTagBarYear(event.target.value)}
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

            {isTagBarPending && <p>Loading analytics…</p>}

            {isTagBarError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {tagBarError.message}
                </p>
            )}

            {!isTagBarPending && !isTagBarError && tagBarData && tagBarData.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed readings.</p>
            )}

            {!isTagBarPending && !isTagBarError && tagBarData && tagBarData.length > 0 && (
                <ReadingBreakdownChart
                    data={(tagBarData ?? []).map((item) => ({ ...item, name: item.tag }))}
                    variant="bar" color="var(--chart-2)"
                />
            )}
        </div>
    );
}
