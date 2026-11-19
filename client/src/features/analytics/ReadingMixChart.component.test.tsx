import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { ReadingMixChart } from './ReadingMixChart';

vi.mock('@/api/client', () => ({ api: vi.fn() }));

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function renderChart() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    return render(<QueryClientProvider client={client}><ReadingMixChart /></QueryClientProvider>);
}

function observeChartSize() {
    let resize: ResizeObserverCallback | undefined;
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: ResizeObserverCallback) {
            resize ??= callback;
        }
        observe() {}
        disconnect() {}
    });
    return async (width: number) => {
        await waitFor(() => expect(resize).toBeDefined());
        act(() => {
            resize?.([{ contentRect: { width, height: 340 } } as ResizeObserverEntry], {} as ResizeObserver);
        });
    };
}

it('retries only the failed year and keeps the selected filters', async () => {
    const failedYear = '/analytics/readings-by-category?year=pre-2022';
    let finishRetry!: (data: { category: string; count: number }[]) => void;
    const retry = new Promise<{ category: string; count: number }[]>(resolve => { finishRetry = resolve; });
    let attempts = 0;
    vi.mocked(api).mockImplementation(async (url) => {
        if (url === '/auth/me') return { role: 'admin' };
        if (url === '/analytics/readings-by-year') return [{ year: 'pre-2022', count: 3 }, { year: 2025, count: 0 }];
        if (url !== failedYear) return [];
        if (++attempts === 1) throw new Error('Unavailable');
        return retry;
    });
    const resizeChart = observeChartSize();
    const { container } = renderChart();
    fireEvent.change(screen.getByLabelText('Breakdown'), { target: { value: 'category' } });
    fireEvent.change(screen.getByLabelText('View'), { target: { value: 'count' } });
    fireEvent.click(await screen.findByLabelText('Include Pre-2022'));
    expect(vi.mocked(api).mock.calls.some(([url]) => url.includes('year=2025'))).toBe(false);

    const button = await screen.findByRole('button', { name: 'Try again' }) as HTMLButtonElement;
    vi.mocked(api).mockClear();
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(vi.mocked(api).mock.calls).toEqual([[failedYear]]);

    finishRetry([{ category: 'Fiction', count: 3 }]);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await resizeChart(900);
    expect(container.querySelector('.recharts-wrapper .recharts-bar')).toBeTruthy();
    expect((screen.getByLabelText('Breakdown') as HTMLSelectElement).value).toBe('category');
    expect((screen.getByLabelText('View') as HTMLSelectElement).value).toBe('count');
    expect((screen.getByLabelText('Include Pre-2022') as HTMLInputElement).checked).toBe(true);
});

it('updates the rendered chart width when its container resizes', async () => {
    const resizeChart = observeChartSize();
    vi.mocked(api).mockImplementation(async url => url === '/analytics/readings-by-year'
        ? [{ year: 2025, count: 3 }]
        : [{ format: 'Print', count: 3 }]);
    const { container } = renderChart();
    for (const width of [900, 700]) {
        await resizeChart(width);
        const chart = container.querySelector('.recharts-wrapper > svg.recharts-surface');
        expect(chart?.getAttribute('width')).toBe(String(width));
        expect(chart?.querySelector('.recharts-bar')).toBeTruthy();
    }
});
