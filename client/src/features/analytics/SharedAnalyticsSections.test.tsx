import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ReadingFormatSection } from './ReadingFormatSection';
import { ReadingsPerYearSection } from './ReadingsPerYearSection';
import type { ReadingYearCount } from './useAnalytics';

const queries = vi.hoisted(() => ({
    role: { value: 'admin' },
    byYear: vi.fn(),
    byFormat: vi.fn(),
}));

vi.mock('./useAnalytics', () => ({
    useReadingsByYear: queries.byYear,
    useReadingsByFormat: queries.byFormat,
}));
vi.mock('@/features/genres/useGenres', () => ({
    useGenres: () => ({ data: [{ id: 7, name: 'Fantasy' }] }),
}));
vi.mock('@/components/ui/chart', () => ({
    ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ChartTooltip: () => null,
    ChartTooltipContent: () => null,
}));
vi.mock('./ReadingBreakdownChart', () => ({
    ReadingBreakdownChart: () => null,
}));
vi.mock('recharts', () => ({
    BarChart: ({ data }: { data: unknown }) => <div data-testid="year-bars">{JSON.stringify(data)}</div>,
    Bar: () => null,
    CartesianGrid: () => null,
    LabelList: () => null,
    XAxis: () => null,
}));

function yearResult(data: ReadingYearCount[]) {
    return { data, isPending: false, isError: false };
}

beforeEach(() => {
    queries.role.value = 'admin';
    queries.byYear.mockReturnValue(yearResult([{ year: 'pre-2022', count: 500 }, { year: 2024, count: 12 }]));
    queries.byFormat.mockReturnValue({ data: [], isPending: false, isError: false });
});
afterEach(cleanup);

it('toggles historical bars without resetting the query filters', () => {
    render(<ReadingsPerYearSection color="var(--chart-1)" />);
    const bars = screen.getByTestId('year-bars');
    expect(bars.textContent).toContain('2024');
    expect(bars.textContent).not.toContain('Pre-2022');

    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'Kindle' } });
    fireEvent.change(screen.getByLabelText('Genre'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Fiction' } });
    const filters = { format: 'Kindle', genreId: 7, category: 'Fiction' };
    expect(queries.byYear).toHaveBeenLastCalledWith(filters);

    const toggle = screen.getByLabelText('Include Pre-2022');
    fireEvent.click(toggle);
    expect(bars.textContent).toContain('Pre-2022');
    expect(queries.byYear).toHaveBeenLastCalledWith(filters);
    fireEvent.click(toggle);
    expect(bars.textContent).not.toContain('Pre-2022');
});

it.each([
    { rows: [], message: 'No completed readings.' },
    { rows: [{ year: 'pre-2022', count: 500 }] satisfies ReadingYearCount[], message: 'No completed readings from 2022 onward.' },
])('shows $message when there are no visible bars', ({ rows, message }) => {
    queries.byYear.mockReturnValue(yearResult(rows));
    render(<ReadingsPerYearSection color="var(--chart-1)" />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByTestId('year-bars')).toBeNull();
});

it.each([
    { Section: () => <ReadingsPerYearSection color="var(--chart-1)" />, query: queries.byYear },
    { Section: ReadingFormatSection, query: queries.byFormat },
])('shows loading and failure states', ({ Section, query }) => {
    query.mockReturnValue({ isPending: true, isError: false });
    const { rerender } = render(<Section />);
    expect(screen.getByText('Loading analytics…')).toBeTruthy();

    query.mockReturnValue({ isPending: false, isError: true, error: new Error('Unavailable') });
    rerender(<Section />);
    expect(screen.getByRole('alert').textContent).toContain('Unavailable');
});

it('passes the selected finish period to the format query', () => {
    render(<ReadingFormatSection />);
    fireEvent.change(screen.getByLabelText('Finish year'), { target: { value: 'pre-2022' } });
    expect(queries.byFormat).toHaveBeenLastCalledWith('pre-2022');
});

vi.mock('@/features/auth/useAuth', () => ({ useMe: () => ({ data: { role: queries.role.value } }) }));


it('offers only populated permitted years and resets an unavailable selection', () => {
    queries.role.value = 'user';
    queries.byYear.mockReturnValue(yearResult([
        { year: 'pre-2022', count: 5 },
        { year: 2024, count: 12 },
        { year: 2025, count: 0 },
        { year: 2026, count: 4 },
    ]));
    const { rerender } = render(<ReadingFormatSection />);
    const select = screen.getByLabelText<HTMLSelectElement>('Finish year');
    expect(Array.from(select.options, option => option.value)).toEqual(['all', '2026', '2024']);
    fireEvent.change(select, { target: { value: '2026' } });
    expect(queries.byFormat).toHaveBeenLastCalledWith(2026);
    queries.byYear.mockReturnValue(yearResult([{ year: 2024, count: 12 }]));
    rerender(<ReadingFormatSection />);
    expect(select.value).toBe('all');
    expect(queries.byFormat).toHaveBeenLastCalledWith(undefined);
});
