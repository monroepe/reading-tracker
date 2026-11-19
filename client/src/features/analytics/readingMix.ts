import type { ReadingPeriod } from '@/lib/readingPeriod';
export type Kind = 'format' | 'category' | 'genre';
export type Count = { format?: string; category?: string; genre?: string; count: number };

export function buildMix(rows: { year: ReadingPeriod; items: Count[] }[], kind: Kind) {
    const totals = new Map<string, number>();
    rows.forEach(row => row.items.forEach(item => {
        const name = item[kind]!;
        totals.set(name, (totals.get(name) ?? 0) + item.count);
    }));
    const names = kind === 'format' ? ['Print', 'Kindle', 'Audiobook', 'Graphic Novel'] : kind === 'category' ? ['Fiction', 'Non-fiction'] : [...totals.keys()].sort((a, b) => totals.get(b)! - totals.get(a)! || a.localeCompare(b)).slice(0, 5);
    const other = kind === 'genre' && totals.size > 5;
    const series = [...names.map((name, i) => ({ name, key: `s${i}` })), ...(other ? [{ name: 'Other', key: 'other' }] : [])];
    const data = rows.map(row => {
        const total = row.items.reduce((sum, item) => sum + item.count, 0);
        const values: Record<string, number | string> = { year: row.year, total };
        series.forEach(s => { values[s.key] = row.items.filter(item => s.key === 'other' ? !names.includes(item[kind]!) : item[kind] === s.name).reduce((sum, item) => sum + item.count, 0); });
        return values;
    });
    return { series, data };
}

