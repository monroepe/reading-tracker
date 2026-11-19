import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useReadingsByGenre } from './useAnalytics';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { LabelList, Pie, PieChart } from 'recharts';

function formatGenrePercent(value: unknown): string {
    const percent = Number(value);

    return percent >= 5 ? `${Math.round(percent)}%` : '';
}

function genreColor(index: number, total: number): string {
    const hue = Math.round((index * 360) / total);

    return `oklch(0.65 0.18 ${hue})`;
}

export function GenreSection() {
    const [selectedPeriod, setGenreYear] = useState('all');
    const { periods: years, year: genreYear } = useChartPeriod(selectedPeriod, setGenreYear);
    const selectedGenreYear = genreYear === 'all' ? undefined : parsePeriod(genreYear);
    const {
        data: genreData,
        isPending: isGenrePending,
        isError: isGenreError,
        error: genreError,
    } = useReadingsByGenre(selectedGenreYear);
    const genreTotal = genreData?.reduce((sum, item) => sum + item.count, 0) ?? 0;
    const genreCount = genreData?.length ?? 0;
    const genreChartData = (genreData ?? []).map((item, index) => ({
        genre: item.genre,
        count: item.count,
        percent: genreTotal === 0 ? 0 : (item.count / genreTotal) * 100,
        fill: genreColor(index, genreCount),
    }));
    const genreChartConfig: ChartConfig = Object.fromEntries(
        genreChartData.map((item) => [item.genre, { label: item.genre, color: item.fill }]),
    );
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by genre</h2>
                    <p className="text-sm text-muted-foreground">
                        Completed, non-abandoned readings by genre, most-read first.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect
                        value={genreYear}
                        onChange={(event) => setGenreYear(event.target.value)}
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

            {isGenrePending && <p>Loading analytics…</p>}

            {isGenreError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {genreError.message}
                </p>
            )}

            {!isGenrePending && !isGenreError && genreData && genreData.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed readings.</p>
            )}

            {!isGenrePending && !isGenreError && genreData && genreData.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
                    <ChartContainer
                        config={genreChartConfig}
                        className="mx-auto min-h-[260px] w-full max-w-[360px]"
                    >
                        <PieChart>
                            <Pie
                                data={genreChartData}
                                dataKey="count"
                                nameKey="genre"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                            >
                                <LabelList
                                    dataKey="percent"
                                    className="fill-background"
                                    stroke="none"
                                    fontSize={12}
                                    formatter={formatGenrePercent}
                                />
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent nameKey="genre" />} />
                        </PieChart>
                    </ChartContainer>

                    <div className="space-y-3">
                        {genreChartData.map((item) => (
                            <div key={item.genre} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="size-3 rounded-sm"
                                        style={{ backgroundColor: item.fill }}
                                    />
                                    <span>{item.genre}</span>
                                </div>
                                <span className="font-medium tabular-nums">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
