import { latestDemoYear } from './library';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HashRouter, MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { DemoApp } from './DemoApp';
import { demoReads } from './library';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

vi.mock('@/features/analytics/ReadingMixChart', () => ({
  ReadingMixChart: () => <h2>Reading mix over time</h2>,
}));

function open(path: string) {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={[path]}><DemoApp /></MemoryRouter>
  </QueryClientProvider>);
  return fetch;
}

it('validates a reading preview and leaves the library unchanged', async () => {
  const fetch = open('/readings/new?bookId=2');
  const submit = await screen.findByRole('button', { name: 'Preview submission' });
  await screen.findAllByDisplayValue(/Catch-22/);
  const start = screen.getByLabelText('Start Date');
  fireEvent.change(start, { target: { value: '' } });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(start, { target: { value: '2025-10-01' } });
  fireEvent.click(submit);
  expect(await screen.findByText('Preview complete. The demo library is unchanged.')).toBeTruthy();
  expect(await demoReads.books.readings(2)).toHaveLength(2);
  expect(fetch).not.toHaveBeenCalled();
});

it('validates a book preview and leaves the catalog unchanged', async () => {
  const { data: [author] } = await demoReads.authors.list({ q: 'George Eliot' });
  const fetch = open(`/books/new?authorId=${author.id}`);
  const submit = await screen.findByRole('button', { name: 'Preview submission' });
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Preview book' } });
  await screen.findAllByDisplayValue(/George Eliot/);
  fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Literary fiction' } });
  fireEvent.change(screen.getByLabelText('Pages'), { target: { value: '150' } });
  fireEvent.click(submit);
  expect(await screen.findByText('Preview complete. The demo library is unchanged.')).toBeTruthy();
  expect((await demoReads.books.list({ q: 'Preview book' })).total).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ['books/2', 'Catch-22'],
  [`analytics/year-in-review/${latestDemoYear}`, `${latestDemoYear} in books`],
])('opens %s directly from a GitHub Pages project URL', async (path, heading) => {
  const originalUrl = window.location.href;
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  window.history.replaceState(null, '', `/reading-tracker/#/${path}`);
  try {
    render(<QueryClientProvider client={new QueryClient()}>
      <HashRouter><DemoApp /></HashRouter>
    </QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Books' }).getAttribute('href')).toMatch(/#\/books$/);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    window.history.replaceState(null, '', originalUrl);
  }
});

it('shows demo authors as compact rows with expandable book counts', async () => {
  const fetch = open('/authors?country=Missing&gender=Missing&sort=country');
  const author = await screen.findByRole('link', { name: 'Chinua Achebe' });
  const row = within(author.closest('li')!);
  expect(screen.getByRole('searchbox', { name: 'Search authors' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Last name: A-Z' })).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
  fireEvent.click(row.getByRole('button', { name: /1 book/ }));
  expect(await row.findByRole('link', { name: 'Things Fall Apart' })).toBeTruthy();
  expect(row.getByLabelText(/out of 10 stars/)).toBeTruthy();
  expect(screen.queryByText('Country', { exact: true })).toBeNull();
  expect(screen.queryByText('Gender', { exact: true })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('omits Reading mix over time from demo analytics', async () => {
  const fetch = open('/analytics');
  expect(await screen.findByRole('heading', { name: 'Analytics' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Reading mix over time' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it('opens the latest review when a historical period is unavailable', async () => {
  const fetch = open('/analytics/year-in-review/pre-2022');
  await screen.findByRole('heading', { name: `${latestDemoYear} in books` });
  expect(screen.queryByRole('button', { name: 'Include graphic novels' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
