import { Bar, BarChart, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

type BreakdownItem = { name: string; count: number; fill?: string };

type Props = {
    data: BreakdownItem[];
    variant: 'doughnut' | 'bar';
    color?: string;
};

export function ReadingBreakdownChart({ data, variant, color = 'var(--chart-1)' }: Props) {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return <p className="text-sm text-muted-foreground">No completed readings.</p>;

    const config = { count: { label: 'Readings', color } } satisfies ChartConfig;
    if (variant === 'bar') {
        return (
            <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 32 + 24) }}>
                <BarChart data={data} layout="vertical" accessibilityLayer margin={{ right: 32 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} interval={0} />
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4}>
                        <LabelList dataKey="count" position="right" offset={8} className="fill-foreground" fontSize={12} />
                    </Bar>
                </BarChart>
            </ChartContainer>
        );
    }

    const chartData = data.map((item, index) => ({
        ...item,
        fill: item.fill ?? `var(--chart-${index % 5 + 1})`,
        percent: item.count / total * 100,
    }));
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
            <ChartContainer config={config} className="mx-auto min-h-[260px] w-full max-w-[360px]">
                <PieChart>
                    <Pie data={chartData} dataKey="count" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        <LabelList dataKey="percent" className="fill-background" stroke="none" fontSize={12}
                            formatter={(value: unknown) => Number(value) > 0 ? `${Math.round(Number(value))}%` : ''} />
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                </PieChart>
            </ChartContainer>
            <div className="space-y-3">
                {chartData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="size-3 rounded-sm" style={{ backgroundColor: item.fill }} />
                            <span>{item.name}</span>
                        </div>
                        <span className="font-medium tabular-nums">{item.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
