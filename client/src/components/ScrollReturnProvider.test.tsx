import { StrictMode, useState, type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useReturnScroll } from '@/hooks/useReturnScroll';
import { ScrollReturnContext } from '@/lib/scrollReturn';
import { FormLink } from './FormLink';
import { ScrollReturnProvider } from './ScrollReturnProvider';

let readyOnMount = true;
const origin = '/books?sort=title&tagId=2&tagId=5#list';

function Page() {
  const [ready, setReady] = useState(readyOnMount);
  const [revision, setRevision] = useState(0);
  useReturnScroll(ready);
  return <>
    <p>{ready ? 'Books loaded' : 'Loading'}</p>
    <FormLink to="/books/1/edit">Edit</FormLink>
    <button onClick={() => setReady(true)}>Load</button>
    <button onClick={() => setRevision(revision + 1)}>Refresh {revision}</button>
    <Link to="/authors">Elsewhere</Link>
  </>;
}

function Form() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get('returnTo') ?? '/books';
  return <>
    <p>Form</p>
    <button onClick={() => navigate(returnTo, { replace: true })}>Save</button>
    <Link to={returnTo}>Cancel</Link>
    <button onClick={() => navigate(-1)}>Back</button>
    <FormLink to="/authors/new">Add author</FormLink>
    <Link to="/authors">Elsewhere</Link>
    <Link to="/books?sort=author">Different filter</Link>
  </>;
}

function CurrentUrl() {
  const location = useLocation();
  return <output>{location.pathname + location.search + location.hash}</output>;
}

function mount(initial = origin) {
  return render(<StrictMode><MemoryRouter initialEntries={[initial]}>
    <ScrollReturnProvider>
      <CurrentUrl />
      <Routes>
        <Route path="/books" element={<Page />} />
        <Route path="/" element={<Page />} />
        <Route path="/books/:id" element={<Page />} />
        <Route path="/authors/:id" element={<Page />} />
        <Route path="/books/:id/edit" element={<Form />} />
        <Route path="/authors/new" element={<Form />} />
        <Route path="/authors" element={<Link to={origin}>Original page</Link>} />
      </Routes>
    </ScrollReturnProvider>
  </MemoryRouter></StrictMode>);
}

beforeEach(() => {
  readyOnMount = true;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('scrollX', 12);
  vi.stubGlobal('scrollY', 900);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(['Save', 'Cancel', 'Back'])('restores the exact position once after %s', async (action) => {
  mount();
  fireEvent.click(screen.getByText('Edit'));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 0, behavior: 'instant' });
  vi.mocked(window.scrollTo).mockClear();
  vi.stubGlobal('scrollY', 0);
  fireEvent.click(screen.getByText(action));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe(origin));
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 12, top: 900, behavior: 'instant' });
  fireEvent.click(screen.getByText('Refresh 0'));
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
});

it('waits for committed content and makes one attempt even when the results are shorter', () => {
  mount();
  fireEvent.click(screen.getByText('Edit'));
  readyOnMount = false;
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByText('Save'));
  expect(screen.getByText('Loading')).toBeDefined();
  expect(window.scrollTo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Load'));
  expect(screen.getByText('Books loaded')).toBeDefined();
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 12, top: 900, behavior: 'instant' });
});

it('keeps the original position through nested forms without restoring parent-form scroll', () => {
  mount();
  fireEvent.click(screen.getByText('Edit'));
  vi.stubGlobal('scrollY', 200);
  fireEvent.click(screen.getByText('Add author'));
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByText('Cancel'));
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 0, top: 0, behavior: 'instant' });
  fireEvent.click(screen.getByText('Save'));
  expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 12, top: 900, behavior: 'instant' });
});

it('discards the snapshot after navigating to an unrelated page', () => {
  mount();
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Elsewhere'));
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByText('Original page'));
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it('does not restore a different filtered version of the same page', () => {
  mount();
  fireEvent.click(screen.getByText('Edit'));
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByText('Different filter'));
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it('cancels restoration when leaving a page that is still loading', () => {
  mount();
  fireEvent.click(screen.getByText('Edit'));
  readyOnMount = false;
  fireEvent.click(screen.getByText('Save'));
  fireEvent.click(screen.getByText('Elsewhere'));
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByText('Original page'));
  fireEvent.click(screen.getByText('Load'));
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it('leaves direct-entry pages alone and restores browser scroll handling on unmount', () => {
  const previous = window.history.scrollRestoration;
  const view = mount();
  expect(window.history.scrollRestoration).toBe('manual');
  expect(window.scrollTo).not.toHaveBeenCalled();
  view.unmount();
  expect(window.history.scrollRestoration).toBe(previous);
});

it.each([
  { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 },
])('does not capture modified clicks: %j', (modifiers) => {
  const capture = vi.fn();
  render(<MemoryRouter><ScrollReturnContext value={{ capture, restore: vi.fn() }}>
    <div onClick={(event) => event.preventDefault()}>
      <FormLink to="/books/new">Open</FormLink>
    </div>
  </ScrollReturnContext></MemoryRouter>);
  fireEvent.click(screen.getByText('Open'), modifiers);
  expect(capture).not.toHaveBeenCalled();
});

it.each([
  { onClick: (event) => event.preventDefault() },
  { target: '_blank' }, { reloadDocument: true }, { download: 'book' },
] satisfies Partial<ComponentProps<typeof FormLink>>[])('does not capture prevented or external navigation: %j', (props) => {
  const capture = vi.fn();
  render(<MemoryRouter><ScrollReturnContext value={{ capture, restore: vi.fn() }}>
    <div onClick={(event) => event.preventDefault()}>
      <FormLink to="/books/new" {...props}>Open</FormLink>
    </div>
  </ScrollReturnContext></MemoryRouter>);
  fireEvent.click(screen.getByText('Open'));
  expect(capture).not.toHaveBeenCalled();
});

it.each(['/?year=2023', '/books/2', '/authors/3'])('restores the supported origin %s', (url) => {
  mount(url);
  fireEvent.click(screen.getByText('Edit'));
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByText('Save'));
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 12, top: 900, behavior: 'instant' });
});
