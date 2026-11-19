import { useReadingControls } from '@/features/auth/useReadingControls';
import { formatAuthor } from '@/lib/format';
import { useState } from 'react';
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { useTopAuthors, type TopAuthorsSort } from './useAnalytics';

const chartConfig = {
    bookCount: { label: 'Books read', color: '#0d9488' },
} satisfies ChartConfig;

export function TopAuthorsChart() {
    const [sort, setSort] = useState<TopAuthorsSort>('books');
    const { graphicNovels } = useReadingControls();
    const [include, setIncludeGraphicNovels] = useState(false);
    const includeGraphicNovels = !graphicNovels || include;
    const { data, isPending, isError, error } = useTopAuthors(sort, includeGraphicNovels);
    const chartData = (data ?? []).map((author) => ({
        ...author,
        name: formatAuthor(author),
    }));

    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="mb-1 text-lg font-medium">Top 10 authors</h2>
                    <p className="text-sm text-muted-foreground">
                        All years · Unique completed books. Average ratings include rereads.
                    </p>
                    {sort === 'rating' && (
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <p>
                                Weighted score = (books read × author’s average rating + 3 × your overall
                                average rating) ÷ (books read + 3)
                            </p>
                            <p>
                                Authors with fewer books stay closer to your overall average. As you read
                                more of an author’s books, their own average has more influence.
                            </p>
                        </div>
                    )}
                </div>
                <div role="group" aria-label="Rank authors by" className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant={sort === 'books' ? 'default' : 'outline'}
                        aria-pressed={sort === 'books'}
                        onClick={() => setSort('books')}
                    >
                        Most read
                    </Button>
                    <Button
                        type="button"
                        variant={sort === 'rating' ? 'default' : 'outline'}
                        aria-pressed={sort === 'rating'}
                        onClick={() => setSort('rating')}
                    >
                        Top rated
                    </Button>
                </div>
            </div>

            {graphicNovels && <label className="mb-4 flex w-fit items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={includeGraphicNovels}
                    onChange={(event) => setIncludeGraphicNovels(event.target.checked)}
                    className="size-4 accent-primary"
                />
                Include graphic novels
            </label>}

            {isPending && <p role="status">Loading top authors…</p>}
            {isError && (
                <p role="alert" className="text-sm text-destructive">
                    Failed to load top authors: {error.message}
                </p>
            )}
            {!isPending && !isError && chartData.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {sort === 'rating' ? 'No rated completed readings.' : 'No completed readings.'}
                </p>
            )}
            {!isPending && !isError && chartData.length > 0 && sort === 'rating' && (
                <ol aria-label="Top authors by weighted rating" className="divide-y">
                    {chartData.map((author, index) => (
                        <li key={author.authorId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                            <span className="w-6 text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
                            <span className="min-w-0 flex-1 font-medium break-words">{author.name}</span>
                            <dl className="flex w-full justify-end gap-4 pl-10 text-right text-sm sm:w-auto sm:pl-0">
                                <div>
                                    <dt className="text-xs text-muted-foreground">Books read</dt>
                                    <dd className="tabular-nums">{author.bookCount}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">Average rating</dt>
                                    <dd className="tabular-nums">{author.averageRating?.toFixed(2) ?? 'Unrated'}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">Weighted score</dt>
                                    <dd className="font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                                        {author.weightedScore?.toFixed(2) ?? 'Unrated'}
                                    </dd>
                                </div>
                            </dl>
                        </li>
                    ))}
                </ol>
            )}
            {!isPending && !isError && chartData.length > 0 && sort === 'books' && (
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto w-full"
                    style={{ height: Math.max(180, chartData.length * 56 + 40) }}
                    aria-label="Top authors by books read"
                >
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        accessibilityLayer
                        margin={{ right: 44 }}
                    >
                        <XAxis
                            type="number"
                            domain={[0, 'auto']}
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            dataKey="authorId"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            width={150}
                            tick={({ x, y, payload }) => (
                                <foreignObject x={Number(x) - 145} y={Number(y) - 25} width={140} height={50}>
                                    <div className="flex h-full items-center justify-end text-right text-xs break-words text-muted-foreground">
                                        {chartData.find((author) => author.authorId === payload.value)?.name}
                                    </div>
                                </foreignObject>
                            )}
                        />
                        <ChartTooltip
                            content={({ active, payload }) => {
                                const author = payload?.[0]?.payload as typeof chartData[number] | undefined;
                                if (!active || !author) {
                                    return null;
                                }

                                return (
                                    <div className="rounded-lg border bg-background p-3 text-sm shadow-xl">
                                        <p className="mb-1 font-medium">{author.name}</p>
                                        <p>Books read: {author.bookCount}</p>
                                        <p>Average rating: {author.averageRating?.toFixed(2) ?? 'Unrated'}</p>
                                    </div>
                                );
                            }}
                        />
                        <Bar dataKey="bookCount" fill="var(--color-bookCount)" radius={4}>
                            <LabelList
                                dataKey="bookCount"
                                position="right"
                                offset={8}
                                className="fill-foreground"
                                fontSize={12}
                                formatter={(value: unknown) => String(value)}
                            />
                        </Bar>
                    </BarChart>
                </ChartContainer>
            )}
        </div>
    );
}
