import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import type { ChartConfig } from '@/components/ui/chart';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useReadingsByCategory } from './useAnalytics';
import { ReadingBreakdownChart } from './ReadingBreakdownChart';

const categoryChartConfig = {
    Fiction: {
        label: 'Fiction',
        color: 'var(--chart-1)',
    },
    'Non-fiction': {
        label: 'Non-fiction',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

export function CategorySection() {
    const [selectedPeriod, setCategoryYear] = useState('all');
    const { periods: years, year: categoryYear } = useChartPeriod(selectedPeriod, setCategoryYear);
    const selectedCategoryYear = categoryYear === 'all' ? undefined : parsePeriod(categoryYear);
    const {
        data: categoryData,
        isPending: isCategoryPending,
        isError: isCategoryError,
        error: categoryError,
    } = useReadingsByCategory(selectedCategoryYear);
    const categoryTotal = categoryData?.reduce((sum, item) => sum + item.count, 0) ?? 0;
    const categoryChartData = (categoryData ?? []).map((item) => ({
        category: item.category,
        count: item.count,
        percent: categoryTotal === 0 ? 0 : (item.count / categoryTotal) * 100,
        fill: categoryChartConfig[item.category].color,
    }));
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by category</h2>
                    <p className="text-sm text-muted-foreground">
                        Fiction vs. non-fiction among completed, non-abandoned readings.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect
                        value={categoryYear}
                        onChange={(event) => setCategoryYear(event.target.value)}
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

            {isCategoryPending && <p>Loading analytics…</p>}

            {isCategoryError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {categoryError.message}
                </p>
            )}

            {!isCategoryPending && !isCategoryError && categoryData && categoryData.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed readings.</p>
            )}

            {!isCategoryPending && !isCategoryError && categoryData && categoryData.length > 0 && (
                <ReadingBreakdownChart
                    data={categoryChartData.map((item) => ({ ...item, name: item.category }))}
                    variant="doughnut"
                />
            )}
        </div>
    );
}
