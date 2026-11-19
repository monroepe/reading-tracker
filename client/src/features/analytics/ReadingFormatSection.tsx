import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import type { ChartConfig } from '@/components/ui/chart';
import { readingFormats } from '@/features/readings/readingTypes';
import { parsePeriod } from '@/lib/readingPeriod';
import { ReadingBreakdownChart } from './ReadingBreakdownChart';
import { useReadingsByFormat } from './useAnalytics';

const chartConfig = {
    Print: {
        label: 'Print',
        color: 'var(--chart-1)',
    },
    Kindle: {
        label: 'Kindle',
        color: 'var(--chart-2)',
    },
    Audiobook: {
        label: 'Audiobook',
        color: 'var(--chart-3)',
    },
    'Graphic Novel': {
        label: 'Graphic Novel',
        color: 'var(--chart-4)',
    },
} satisfies ChartConfig;

export function ReadingFormatSection() {
    const [selectedPeriod, setYear] = useState('all');
    const { periods: years, year: year } = useChartPeriod(selectedPeriod, setYear);
    const selectedYear = year === 'all' ? undefined : parsePeriod(year);
    const { data, isPending, isError, error } = useReadingsByFormat(selectedYear);
    const total = data?.reduce((sum, item) => sum + item.count, 0) ?? 0;
    const chartData = readingFormats.map((format) => {
        const count = data?.find((item) => item.format === format)?.count ?? 0;

        return {
            format,
            count,
            percent: total === 0 ? 0 : (count / total) * 100,
            fill: chartConfig[format].color,
        };
    });
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by format</h2>
                    <p className="text-sm text-muted-foreground">
                        Distribution of completed, non-abandoned readings by format.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect value={year} onChange={(event) => setYear(event.target.value)}>
                        <option value="all">All years</option>
                        {years.map((optionYear) => (
                            <option key={optionYear} value={optionYear}>
                                {periodLabel(optionYear)}
                            </option>
                        ))}
                    </NativeSelect>
                </label>
            </div>

            {isPending && <p>Loading analytics…</p>}

            {isError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {error.message}
                </p>
            )}

            {!isPending && !isError && data && (
                <ReadingBreakdownChart
                    data={chartData.map((item) => ({ ...item, name: item.format }))}
                    variant="doughnut"
                />
            )}
        </div>
    );
}
