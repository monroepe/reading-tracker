import { useAvailablePeriods } from './useAvailablePeriods';
import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useReadData } from '@/data/readData';
import { api } from '@/api/client';
import { NativeSelect } from '@/components/ui/native-select';
import type { ReadingPeriod } from '@/lib/readingPeriod';

import { QueryError } from './QueryError';
import { buildMix, type Kind, type Count } from './readingMix';

export function ReadingMixChart() {
    const [kind, setKind] = useState<Kind>('format');
    const [percentage, setPercentage] = useState(true);
    const [includePre, setIncludePre] = useState(false);
    const [retryingSelections, setRetryingSelections] = useState<ReadonlySet<string>>(new Set());
    const reads = useReadData();
    const currentYear = new Date().getFullYear();
    const { query: periodsQuery, periods } = useAvailablePeriods();
    const years = periods.filter(year => year !== 'pre-2022' || includePre).reverse();
    const queries = useQueries({
        queries: years.map(year => ({
            queryKey: ['analytics', `readings-by-${kind}`, year],
            queryFn: async (): Promise<Count[]> => {
                if (reads.analytics) {
                    if (kind === 'format') return reads.analytics.byFormat(year);
                    if (kind === 'category') return reads.analytics.byCategory(year);
                    return reads.analytics.byGenre(year);
                }
                return api(`/analytics/readings-by-${kind}?year=${year}`);
            },
        })),
    });
    const failedQueries = queries.filter(query => query.isError);
    const selection = `${kind}:${includePre}`;
    const retrying = retryingSelections.has(selection);

    async function retryFailedYears() {
        setRetryingSelections(previous => new Set(previous).add(selection));
        try {
            await Promise.all(failedQueries.map(query => query.refetch({ cancelRefetch: false })));
        } finally {
            setRetryingSelections(previous => {
                const remaining = new Set(previous);
                remaining.delete(selection);
                return remaining;
            });
        }
    }

    const { series, data } = buildMix(years.map((year, i) => ({ year, items: queries[i].data ?? [] })), kind);
    const chartData = data.map(row => {
        if (!percentage) return row;
        const formattedRow = { ...row };
        for (const { key } of series) {
            formattedRow[key] = row.total ? Number(row[key]) / Number(row.total) * 100 : 0;
        }
        return formattedRow;
    });

    return (
        <section className="space-y-4 rounded-lg border p-6" aria-label="Reading mix over time">
            <h2 className="text-lg font-medium">Reading mix over time</h2>
            <p className="text-sm text-muted-foreground">
                Completed readings by finish year, including rereads. Historical readings use current classifications.
            </p>
            <div className="flex flex-wrap items-center gap-4">
                <label>
                    Breakdown
                    <NativeSelect value={kind} onChange={event => setKind(event.target.value as Kind)}>
                        <option value="format">Format</option>
                        <option value="category">Category</option>
                        <option value="genre">Genre</option>
                    </NativeSelect>
                </label>
                <label>
                    View
                    <NativeSelect value={percentage ? 'percentage' : 'count'} onChange={event => setPercentage(event.target.value === 'percentage')}>
                        <option value="percentage">Percentage</option>
                        <option value="count">Count</option>
                    </NativeSelect>
                </label>
                {periods.includes('pre-2022') && <label className="flex items-center gap-2">
                    <input type="checkbox" checked={includePre} onChange={event => setIncludePre(event.target.checked)} />
                    Include Pre-2022
                </label>}
            </div>

            {periodsQuery.isError ? (
                <QueryError message="Failed to load reading years." retry={() => { void periodsQuery.refetch(); }} />
            ) : retrying || failedQueries.length > 0 ? (
                <QueryError
                    message="Failed to load reading mix."
                    retrying={retrying}
                    retry={() => { void retryFailedYears(); }}
                />
            ) : periodsQuery.isPending || queries.some(query => query.isPending) ? (
                <p role="status">Loading analytics…</p>
            ) : !data.some(row => Number(row.total) > 0) ? (
                <p>No completed readings.</p>
            ) : (
                <div className="overflow-x-auto">
                    <div style={{ minWidth: years.length * 65, height: 340 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="year" tickFormatter={year => formatYear(year, currentYear)} />
                                <YAxis
                                    domain={percentage ? [0, 100] : [0, 'auto']}
                                    allowDecimals={percentage}
                                    tickFormatter={value => percentage ? `${value}%` : String(value)}
                                />
                                <Tooltip content={({ active, label }) => {
                                    const row = data.find(item => String(item.year) === String(label));
                                    if (!active || !row) return null;
                                    return (
                                        <div className="rounded border bg-background p-3 text-sm">
                                            <p>{label} · {row.total} readings</p>
                                            {series.map(({ key, name }) => {
                                                const share = row.total ? Math.round(Number(row[key]) / Number(row.total) * 100) : 0;
                                                return <p key={key}>{name}: {row[key]} · {share}%</p>;
                                            })}
                                        </div>
                                    );
                                }} />
                                <Legend />
                                {series.map(({ key, name }, index) => (
                                    <Bar key={key} dataKey={key} name={name} stackId="mix" fill={`var(--chart-${index % 5 + 1})`} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </section>
    );
}

function formatYear(year: ReadingPeriod, currentYear: number) {
    if (year === 'pre-2022') return 'Pre-2022';
    return Number(year) === currentYear ? `${year} so far` : String(year);
}
