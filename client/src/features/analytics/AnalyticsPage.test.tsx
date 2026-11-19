vi.mock('@/features/analytics/ReadingMixChart', () => ({ ReadingMixChart: () => null }));
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';
vi.mock('@/features/analytics/useAnalytics', () => {
 const empty = () => ({data:[],isPending:false,isError:false});
 return {useReadingsByFormat:vi.fn(empty),useReadingsByCategory:vi.fn(empty),useReadingsByGenre:vi.fn(empty),useReadingsByTag:vi.fn(empty),useReadingsByGender:empty,useReadingsByCountry:empty,useReadingsByYear:() => ({...empty(),data:[{year:2024,count:2},{year:2025,count:0}]})};
});
vi.mock('@/features/analytics/TopBooksChart', () => ({TopBooksChart:() => null}));
vi.mock('@/features/genres/useGenres', () => ({useGenres:() => ({data:[]})}));
vi.mock('@/features/analytics/TopAuthorsChart', () => ({TopAuthorsChart:() => null}));
vi.mock('@/components/ui/chart', () => ({ChartContainer:({children}: {children: React.ReactNode}) => <div>{children}</div>,ChartTooltip:() => null,ChartTooltipContent:() => null}));
vi.mock('recharts', () => ({BarChart:({data}: {data:unknown}) => <div data-testid="year-bars">{JSON.stringify(data)}</div>,Bar:() => null,CartesianGrid:() => null,LabelList:() => null,XAxis:() => null,YAxis:() => null,Pie:() => null,PieChart:() => null}));
afterEach(cleanup);
it('renders both shared chart sections', () => {
    render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Readings by format' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Readings per year' })).toBeTruthy();
});

it('keeps format query and rendering isolated when the year-chart filter changes', async () => {
 const hooks = await import('@/features/analytics/useAnalytics');
 render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
 vi.mocked(hooks.useReadingsByFormat).mockClear();
 fireEvent.change(screen.getByLabelText('Format'), {target:{value:'Kindle'}});
 expect(hooks.useReadingsByFormat).not.toHaveBeenCalled();
});
it('keeps breakdown years independent', async () => {
 const hooks = await import('@/features/analytics/useAnalytics');
 render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
 const section = screen.getByRole('heading', {name: 'Readings by category'}).closest('div.rounded-lg')! as HTMLElement;
 vi.mocked(hooks.useReadingsByGenre).mockClear();
 vi.mocked(hooks.useReadingsByTag).mockClear();
 fireEvent.change(within(section).getByRole('combobox'), {target:{value:'2024'}});
 expect(hooks.useReadingsByCategory).toHaveBeenLastCalledWith(2024);
 expect(hooks.useReadingsByGenre).not.toHaveBeenCalled();
 expect(hooks.useReadingsByTag).not.toHaveBeenCalled();
});

vi.mock('@/features/auth/useAuth', () => ({ useMe: () => ({ data: { role: 'admin' } }) }));
