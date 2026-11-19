import { periodLabel } from '@/lib/readingPeriod';
import { useChartPeriod } from './useAvailablePeriods';
import { parsePeriod } from '@/lib/readingPeriod';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useReadingsByGender } from './useAnalytics';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { LabelList, Pie, PieChart } from 'recharts';

const genderChartConfig = {
    Female: {
        label: 'Female',
        color: 'var(--chart-1)',
    },
    Male: {
        label: 'Male',
        color: 'var(--chart-2)',
    },
    'Non-binary': {
        label: 'Non-binary',
        color: 'var(--chart-3)',
    },
} satisfies ChartConfig;

function formatPercent(value: unknown): string {
    const percent = Number(value);

    return percent > 0 ? `${Math.round(percent)}%` : '';
}

export function GenderSection() {
    const [selectedPeriod, setGenderYear] = useState('all');
    const { periods: years, year: genderYear } = useChartPeriod(selectedPeriod, setGenderYear);
    const selectedGenderYear = genderYear === 'all' ? undefined : parsePeriod(genderYear);
    const {
        data: genderData,
        isPending: isGenderPending,
        isError: isGenderError,
        error: genderError,
    } = useReadingsByGender(selectedGenderYear);
    const genderTotal = genderData?.reduce((sum, item) => sum + item.count, 0) ?? 0;
    const genderChartData = (genderData ?? []).map((item) => ({
        gender: item.gender,
        count: item.count,
        percent: genderTotal === 0 ? 0 : (item.count / genderTotal) * 100,
        fill: genderChartConfig[item.gender].color,
    }));
    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Readings by author gender</h2>
                    <p className="text-sm text-muted-foreground">
                        Completed, non-abandoned readings by author gender. Authors with no gender set are excluded.
                    </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                    Finish year
                    <NativeSelect
                        value={genderYear}
                        onChange={(event) => setGenderYear(event.target.value)}
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

            {isGenderPending && <p>Loading analytics…</p>}

            {isGenderError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load analytics: {genderError.message}
                </p>
            )}

            {!isGenderPending && !isGenderError && genderData && genderData.length === 0 && (
                <p className="text-sm text-muted-foreground">No completed readings.</p>
            )}

            {!isGenderPending && !isGenderError && genderData && genderData.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
                    <ChartContainer
                        config={genderChartConfig}
                        className="mx-auto min-h-[260px] w-full max-w-[360px]"
                    >
                        <PieChart>
                            <Pie
                                data={genderChartData}
                                dataKey="count"
                                nameKey="gender"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                            >
                                <LabelList
                                    dataKey="percent"
                                    className="fill-background"
                                    stroke="none"
                                    fontSize={12}
                                    formatter={formatPercent}
                                />
                            </Pie>
                            <ChartTooltip content={<ChartTooltipContent nameKey="gender" />} />
                        </PieChart>
                    </ChartContainer>

                    <div className="space-y-3">
                        {genderChartData.map((item) => (
                            <div key={item.gender} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="size-3 rounded-sm"
                                        style={{ backgroundColor: genderChartConfig[item.gender].color }}
                                    />
                                    <span>{item.gender}</span>
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
