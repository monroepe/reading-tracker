import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { YearInReviewPage } from './YearInReviewPage';
import type { YearInReview } from './useAnalytics';

const { state } = vi.hoisted(() => ({ state: { data: {} as YearInReview } }));
vi.mock('./useAnalytics', () => ({
    useYearInReview: () => ({ data: state.data }),
    useReadingsByYear: () => ({ data: [{ year: 2025, count: 3 }] }),
}));
vi.mock('./ReadingBreakdownChart', () => ({ ReadingBreakdownChart: () => null }));
afterEach(cleanup);
beforeEach(() => {
    state.data = {
        year: 2025, total: 3, totalPages: 300, topBooks: [], topAuthors: [],
        byFormat: [], byCategory: [],
        byTag: [{ tag: 'Adventure', count: 2 }, { tag: 'Travel', count: 2 }],
        byGenre: [{ genre: 'Fantasy', count: 3 }, { genre: 'Mystery', count: 1 }],
    };
});
function summary() {
    render(<MemoryRouter initialEntries={['/analytics/year-in-review/2025']}><Routes>
        <Route path="/analytics/year-in-review/:year" element={<YearInReviewPage />} />
    </Routes></MemoryRouter>);
    return screen.getByText('Completed readings · All formats').parentElement!.parentElement!;
}
it('shows the highest genre and the alphabetically first tag from tied sorted results', () => {
    const content = summary().textContent;
    expect(content).toContain('AdventureTop tag2 completed readings');
    expect(content).toContain('FantasyTop genre3 completed readings');
    expect(content).not.toContain('Travel');
});
it('shows None without a count for missing tags', () => {
    state.data.byTag = [];
    const grid = summary();
    expect(grid.textContent).toContain('NoneTop tag');
    expect(screen.getByText('Top tag').parentElement!.textContent).toBe('NoneTop tag');
});
it('handles an empty period', () => {
    state.data = { ...state.data, total: 0, totalPages: 0, byTag: [], byGenre: [] };
    summary();
    expect(screen.getAllByText('None')).toHaveLength(2);
    expect(screen.getByText('No completed readings in 2025.')).toBeTruthy();
});
it('uses the singular count label', () => {
    state.data.byTag = [{ tag: 'Adventure', count: 1 }];
    expect(summary().textContent).toContain('AdventureTop tag1 completed reading');
});

vi.mock('@/features/auth/useAuth', () => ({ useMe: () => ({ data: { role: 'admin' } }) }));
