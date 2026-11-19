import { useReadingControls } from '@/features/auth/useReadingControls';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { NativeSelect } from '@/components/ui/native-select';
import { useGenres } from '@/features/genres/useGenres';
import { readingFormats } from '@/features/readings/readingTypes';
import { periodLabel } from '@/lib/readingPeriod';
import { useReadingsByYear, type ReadingCategory, type ReadingFormat } from './useAnalytics';

const categories = ['Fiction', 'Non-fiction'] as const;

export function ReadingsPerYearSection({ color }: { color: string }) {
    const chartConfig = { count: { label: 'Readings', color } };
    const { pre2022 } = useReadingControls();
    const [includePre2022, setIncludePre2022] = useState(false);
    const [yearFormat, setYearFormat] = useState<ReadingFormat | 'all'>('all');
    const [yearGenreId, setYearGenreId] = useState<string>('all');
    const [yearCategory, setYearCategory] = useState<ReadingCategory | 'all'>('all');
    const { data: genreOptions } = useGenres();
    const {
        data: yearData,
        isPending: isYearPending,
        isError: isYearError,
        error: yearError,
    } = useReadingsByYear({
        format: yearFormat === 'all' ? undefined : yearFormat,
        genreId: yearGenreId === 'all' ? undefined : Number(yearGenreId),
        category: yearCategory === 'all' ? undefined : yearCategory,
    });
    const visibleYearData = yearData?.filter(item => (pre2022 && includePre2022) || item.year !== 'pre-2022');
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings per year</h2>
                    <p className="text-sm text-muted-foreground">
                        Completed, non-abandoned readings by finish year.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {pre2022 && <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={includePre2022}
                            onChange={event => setIncludePre2022(event.target.checked)}
                            className="size-4 accent-primary" />
                        Include Pre-2022
                    </label>}
                    <label className="flex items-center gap-2 text-sm">
                        Format
                        <NativeSelect
                            value={yearFormat}
                            onChange={(event) =>
                                setYearFormat(event.target.value as ReadingFormat | 'all')
                            }
                        >
                            <option value="all">All formats</option>
                            {readingFormats.map((optionFormat) => (
                                <option key={optionFormat} value={optionFormat}>
                                    {optionFormat}
                                </option>
                            ))}
                        </NativeSelect>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        Genre
                        <NativeSelect
                            value={yearGenreId}
                            onChange={(event) => setYearGenreId(event.target.value)}
                        >
                            <option value="all">All genres</option>
                            {(genreOptions ?? []).map((optionGenre) => (
                                <option key={optionGenre.id} value={optionGenre.id}>
                                    {optionGenre.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        Category
                        <NativeSelect
                            value={yearCategory}
                            onChange={(event) =>
                                setYearCategory(event.target.value as ReadingCategory | 'all')
                            }
                        >
                            <option value="all">All categories</option>
                            {categories.map((optionCategory) => (
                                <option key={optionCategory} value={optionCategory}>
                                    {optionCategory}
                                </option>
                            ))}
                        </NativeSelect>
                    </label>
                </div>
            </div>

            {isYearPending && <p>Loading analytics…</p>}

            {isYearError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {yearError.message}
                </p>
            )}

            {!isYearPending && !isYearError && visibleYearData && visibleYearData.length === 0 && (
                <p className="text-sm text-muted-foreground">{!includePre2022 && yearData?.some(item => item.year === 'pre-2022') ? 'No completed readings from 2022 onward.' : 'No completed readings.'}</p>
            )}

            {!isYearPending && !isYearError && visibleYearData && visibleYearData.length > 0 && (
                <ChartContainer config={chartConfig} className="h-[240px] w-full">
                    <BarChart data={visibleYearData.map((item) => ({ ...item, year: periodLabel(item.year) }))} accessibilityLayer margin={{ top: 20 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                            <LabelList
                                dataKey="count"
                                position="top"
                                offset={8}
                                className="fill-foreground"
                                fontSize={12}
                            />
                        </Bar>
                    </BarChart>
                </ChartContainer>
            )}
        </div>
    );
}
