import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useReadingsByCountry } from './useAnalytics';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';

const countryChartConfig = {
    count: {
        label: 'Readings',
        color: 'var(--chart-3)',
    },
} satisfies ChartConfig;

export function CountrySection() {
    const [selectedPeriod, setCountryYear] = useState('all');
    const { periods: years, year: countryYear } = useChartPeriod(selectedPeriod, setCountryYear);
    const selectedCountryYear = countryYear === 'all' ? undefined : parsePeriod(countryYear);
    const {
        data: countryData,
        isPending: isCountryPending,
        isError: isCountryError,
        error: countryError,
    } = useReadingsByCountry(selectedCountryYear);
    const countryChartHeight = Math.max(160, (countryData?.length ?? 0) * 32 + 24);
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by author country</h2>
                    <p className="text-sm text-muted-foreground">
                        Completed, non-abandoned readings by author country, most-read first. Authors with no country set are excluded. Each reading counts toward every associated country, so totals can exceed total readings.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect
                        value={countryYear}
                        onChange={(event) => setCountryYear(event.target.value)}
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

            {isCountryPending && <p>Loading analytics…</p>}

            {isCountryError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {countryError.message}
                </p>
            )}

            {!isCountryPending && !isCountryError && countryData && countryData.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed readings.</p>
            )}

            {!isCountryPending && !isCountryError && countryData && countryData.length > 0 && (
                <ChartContainer
                    config={countryChartConfig}
                    className="w-full"
                    style={{ height: countryChartHeight }}
                >
                    <BarChart
                        data={countryData}
                        layout="vertical"
                        accessibilityLayer
                        margin={{ right: 32 }}
                    >
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="country"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            width={120}
                        />
                        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                            <LabelList
                                dataKey="count"
                                position="right"
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
