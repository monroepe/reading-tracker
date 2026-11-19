import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { FormLink } from './FormLink';
import { NewReadingPage } from '@/features/readings/pages/NewReadingPage';
import { EditReadingPage } from '@/features/readings/pages/EditReadingPage';
import { FinishReadingPage } from '@/features/readings/pages/FinishReadingPage';
import { AddBookPage } from '@/features/books/pages/AddBookPage';
import { EditBookPage } from '@/features/books/pages/EditBookPage';
import { AddAuthorPage } from '@/features/authors/pages/AddAuthorPage';
import { EditAuthorPage } from '@/features/authors/pages/EditAuthorPage';
import { Link } from 'react-router';
import { safeReturnTo, withParam } from '@/lib/navigation';

const mocks = vi.hoisted(() => ({
  fail: false,
  mutate: vi.fn((_payload: unknown, options: { onSuccess: (entity: { id: number }) => void }) => {
    if (!mocks.fail) options.onSuccess({ id: 42 });
  }),
  entity: {
    id: 1, book: { id: 2, title: 'Book' }, author: { id: 3, firstName: 'Ann', lastName: 'Smith' },
    genre: { name: 'Fiction' }, tags: [], title: 'Book', pageCount: 100,
  },
}));
vi.mock('@/features/readings/api/useCreateReading', () => ({ useCreateReading: () => mocks }));
vi.mock('@/features/readings/api/useUpdateReading', () => ({ useUpdateReading: () => mocks }));
vi.mock('@/features/readings/api/useFinishReading', () => ({ useFinishReading: () => mocks }));
vi.mock('@/features/readings/api/useDeleteReading', () => ({ useDeleteReading: () => mocks }));
vi.mock('@/features/books/api/useCreateBook', () => ({ useCreateBook: () => mocks }));
vi.mock('@/features/books/api/useUpdateBook', () => ({ useUpdateBook: () => mocks }));
vi.mock('@/features/books/api/useDeleteBook', () => ({ useDeleteBook: () => mocks }));
vi.mock('@/features/authors/api/useCreateAuthor', () => ({ useCreateAuthor: () => mocks }));
vi.mock('@/features/authors/api/useUpdateAuthor', () => ({ useUpdateAuthor: () => mocks }));
vi.mock('@/features/authors/api/useDeleteAuthor', () => ({ useDeleteAuthor: () => mocks }));
vi.mock('@/features/readings/api/useReading', () => ({ useReading: () => ({ data: mocks.entity }) }));
vi.mock('@/features/books/api/useBook', () => ({ useBook: () => ({ data: mocks.entity }) }));
vi.mock('@/features/authors/api/useAuthor', () => ({ useAuthor: () => ({ data: mocks.entity }) }));
vi.mock('@/components/ConfirmDialog', () => ({ ConfirmDialog: () => null }));

// Keep navigation real while isolating the route pages from form fields and API calls.
function TestForm({ cancelTo, onSubmit }: { cancelTo: string; onSubmit: (values: object, tags: never[]) => void }) {
  return <><button onClick={() => onSubmit({}, [])}>Save</button><Link to={cancelTo}>Cancel</Link></>;
}
vi.mock('@/features/readings/components/ReadingForm', () => ({ ReadingForm: (props: Parameters<typeof TestForm>[0]) => <TestForm {...props} /> }));
vi.mock('@/features/books/components/BookForm', () => ({ BookForm: (props: Parameters<typeof TestForm>[0]) => <TestForm {...props} /> }));
vi.mock('@/features/authors/components/AuthorForm', () => ({ AuthorForm: (props: Parameters<typeof TestForm>[0]) => <TestForm {...props} /> }));

function CurrentUrl() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname + location.search + location.hash}</output>;
}
const cases = [
  { path: '/readings/new', page: <NewReadingPage />, fallback: '/' },
  { path: '/readings/1/edit', page: <EditReadingPage />, fallback: '/' },
  { path: '/readings/1/finish', page: <FinishReadingPage />, fallback: '/' },
  { path: '/books/new', page: <AddBookPage />, fallback: '/books' },
  { path: '/books/1/edit', page: <EditBookPage />, fallback: '/books' },
  { path: '/authors/new', page: <AddAuthorPage />, fallback: '/authors' },
  { path: '/authors/1/edit', page: <EditAuthorPage />, fallback: '/authors' },
];
function mountForm(path: string) {
  render(<MemoryRouter initialEntries={[path]}><CurrentUrl /><Routes>
    {cases.map(({ path: routePath, page }) => (
      <Route key={routePath} path={routePath.replace('/1/', '/:id/')} element={page} />
    ))}
    <Route path="*" element={<p>Returned</p>} />
  </Routes></MemoryRouter>);
}
afterEach(() => { cleanup(); mocks.fail = false; });
const origin = '/?year=2023&sort=title&order=asc&q=A%26B&tagId=2&tagId=5&authorId=9&page=3#log';

describe.each(cases)('$path', ({ path, fallback }) => {
  it.each(['Save', 'Cancel'])('%s returns to the exact originating URL', async (action) => {
    mountForm(withParam(path, 'returnTo', origin));
    fireEvent.click(screen.getByText(action));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(origin));
    expect(mocks.mutate).toHaveBeenCalledTimes(action === 'Save' ? 1 : 0);
  });
  it.each(['Save', 'Cancel'])('%s uses the direct-entry fallback', async (action) => {
    mountForm(path);
    fireEvent.click(screen.getByText(action));
    await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(fallback));
  });
  it('stays on the form after a failed save', () => {
    mocks.fail = true;
    const url = withParam(path, 'returnTo', origin);
    mountForm(url);
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByTestId('url').textContent).toBe(url);
  });
});

it.each(['/', '/books', '/authors', '/books/2', '/authors/3'])('captures the full origin from %s', (path) => {
  const url = path + '?year=2023&tagId=2&tagId=5&q=A%26B&page=3#rows';
  render(<MemoryRouter initialEntries={[url]}><FormLink to="/readings/new?title=Hello">Open</FormLink></MemoryRouter>);
  const link = screen.getByRole('link') as HTMLAnchorElement;
  expect(new URL(link.href).searchParams.get('returnTo')).toBe(url);
  expect(new URL(link.href).searchParams.get('title')).toBe('Hello');
});

it.each([
  { path: '/books/new', parent: '/readings/new', key: 'bookId' },
  { path: '/authors/new', parent: '/books/new', key: 'authorId' },
])('nested creation from $path preserves the outer destination', async ({ path, parent, key }) => {
  const parentUrl = withParam(parent, 'returnTo', origin);
  mountForm(withParam(withParam(path, 'returnTo', parentUrl), 'selectCreated', 'true'));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(withParam(parentUrl, key, '42')));
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(origin));
});

it.each(['https://example.com', '//example.com', null])('rejects invalid return path %s', (value) => {
  expect(safeReturnTo(value, '/')).toBe('/');
});

it.each([
  { path: '/books/new', parent: '/readings/new' },
  { path: '/authors/new', parent: '/books/new' },
])('Cancel from $path returns to its immediate parent without a selection', async ({ path, parent }) => {
  const parentUrl = withParam(parent, 'returnTo', origin);
  mountForm(withParam(withParam(path, 'returnTo', parentUrl), 'selectCreated', 'true'));
  fireEvent.click(screen.getByText('Cancel'));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(parentUrl));
  expect(mocks.mutate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancel'));
  await waitFor(() => expect(screen.getByTestId('url').textContent).toBe(origin));
});
