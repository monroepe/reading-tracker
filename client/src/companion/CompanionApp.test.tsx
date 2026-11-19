import { ScrollReturnContext } from '@/lib/scrollReturn';
import { freezeOutbound } from './storage/outbound';
import { importRefresh } from './storage/refresh';
import { shareOutbound } from './share';
/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompanionApp } from './CompanionApp';
import { createSqliteWriteData } from './storage/writeData';
import { createSqliteReadData } from './storage/readData';
import { createBootstrap } from './storage/snapshot';
import { metadata, migrate, type SqlDatabase } from './storage/database';
import { fixture, uuid } from './storage/fixtures.test-helper';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { ReadOnlyContext } from '@/data/capabilities';
import { AdminOnly } from '@/features/auth/AdminOnly';
import { WriteOnly } from '@/components/WriteOnly';
const state = vi.hoisted(() => ({ storage: {} as object, remove: vi.fn() }));
vi.mock('./share', () => ({ shareOutbound: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./storage/native', () => ({ openCompanionStorage: async () => state.storage }));
vi.mock('@capacitor/app', () => ({ App: { addListener: async () => ({ remove: state.remove }), minimizeApp: vi.fn() } }));
let engine: DatabaseSync;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
    ['/authors/new', '/books/new', '/readings/new', '/readings/2/edit', '/readings/2/finish'].forEach(clearFormDraft);
    engine = new DatabaseSync(':memory:');
    const db: SqlDatabase = {
        execute: async (sql) => { engine.exec(sql); },
        run: async (sql, values = []) => { engine.prepare(sql).run(...values as SQLInputValue[]); },
        query: async <T,>(sql: string, values: unknown[] = []) => engine.prepare(sql).all(...values as SQLInputValue[]) as T[],
    };
    await migrate(db, uuid(4));
    await createBootstrap(db)(fixture(), 'hash');
    const reads = await createSqliteReadData(db, '2026-11-02');
    const writes = createSqliteWriteData(db, async () => {
        const next = await createSqliteReadData(db, '2026-11-02');
        for (const key of Object.keys(reads) as (keyof typeof reads)[]) Object.assign(reads[key] ?? {}, next[key]);
    });
    state.storage = { exportChanges: () => freezeOutbound(db), applyRefresh: (input: unknown, hash: string) => importRefresh(db, input, hash), writes, db, info: () => metadata(db), reads: async () => reads, reload: async () => {}, bootstrap: createBootstrap(db) };
    fetchMock = vi.fn().mockRejectedValue(new Error('Unexpected network request'));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal('ResizeObserver', class {
        observe() { }
        unobserve() { }
        disconnect() { }
    });
});
afterEach(() => { cleanup(); engine.close(); vi.unstubAllGlobals(); });
function app(path: string, navigation?: React.ReactNode, restore = () => {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><ScrollReturnContext value={{ capture: () => {}, restore }}><CompanionApp />{navigation}</ScrollReturnContext></MemoryRouter></QueryClientProvider>);
}
it('reuses Log and its expanded review with entry controls and no auth requests', async () => {
    app('/?year=2026');
    await screen.findByRole('heading', { name: '2026' });
    await screen.findAllByText('The Dispossessed');
    expect(screen.getByText('Add reading')).toBeTruthy();
    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Finish' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Review/ })[0]);
    expect(screen.getByText('A review')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
});
it('reuses book expansion and follows author links offline', async () => {
    app('/books');
    await screen.findAllByText('The Dispossessed');
    expect(screen.getByText('Add book')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Readings/ })[0]);
    await screen.findAllByText('Date uncertain');
    fireEvent.click(screen.getAllByRole('link', { name: 'Octavia Butler' })[0]);
    await screen.findByRole('heading', { name: 'Octavia Butler' });
    await screen.findAllByText('Kindred');
    expect(fetchMock).not.toHaveBeenCalled();
});
it('renders book details and history without session-dependent controls', async () => {
    app('/books/1');
    await screen.findByRole('heading', { name: 'The Dispossessed' });
    await screen.findAllByText('Print');
    expect(screen.queryByText('Add Tags')).toBeNull();
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
});
it('reuses author list, countries and expandable book queries', async () => {
    app('/authors');
    await screen.findAllByText('Ursula K. Le Guin');
    expect(screen.getByText('Add author')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /1 book/ })[0]);
    await screen.findAllByText('Kindred');
    expect(fetchMock).not.toHaveBeenCalled();
});
it('exposes entry routes and snapshot status', async () => {
    app('/readings/new');
    await screen.findByRole('heading', { name: 'Log reading' });
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Transfers & settings' }));
    await screen.findByRole('heading', { name: 'Import and settings' });
    expect(screen.getByText(uuid(3))).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
});
it('keeps desktop actions and role checks while hiding companion actions without auth', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 1, email: 'test@example.test', role: 'admin' })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><WriteOnly><button>Add reading</button></WriteOnly><AdminOnly><button>Edit book</button></AdminOnly></QueryClientProvider>);
    expect(screen.getByText('Add reading')).toBeTruthy();
    await screen.findByText('Edit book');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.rerender(<QueryClientProvider client={client}><ReadOnlyContext value={true}><WriteOnly><button>Add reading</button></WriteOnly><AdminOnly><button>Edit book</button></AdminOnly></ReadOnlyContext></QueryClientProvider>);
    await waitFor(() => { expect(screen.queryByText('Add reading')).toBeNull(); expect(screen.queryByText('Edit book')).toBeNull(); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('adds an author through the reused form and refreshes the list without HTTP', async () => {
    app('/authors/new');
    await screen.findByRole('heading', { name: 'Add author' });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Writer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findAllByText('Ann Writer');
    expect(fetchMock).not.toHaveBeenCalled();
});
it('finishes a reading locally and hides deletion from the edit page', async () => {
    app('/readings/2/finish');
    await screen.findByRole('heading', { name: 'Finish reading' });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Rating' }), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Review'), { target: { value: 'Saved offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: String(new Date().getFullYear()) });
    const saved = engine.prepare('SELECT data FROM readings WHERE id = 2').get() as { data: string };
    expect(JSON.parse(saved.data)).toMatchObject({ review: 'Saved offline', rating: 9 });
    expect(fetchMock).not.toHaveBeenCalled();
});
it('offers book creation using local genres without a session or catalog-edit controls', async () => {
    app('/books/new');
    await screen.findByRole('heading', { name: 'Add book' });
    expect(screen.getByLabelText('Genre')).toBeTruthy();
    expect(screen.queryByText('Delete reading')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
});
it('keeps reading dates and format when returning from nested book creation', async () => {
    app('/readings/new', <Link to="/books/new?returnTo=%2Freadings%2Fnew">Nested book route</Link>);
    await screen.findByRole('heading', { name: 'Log reading' });
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'Kindle' } });
    fireEvent.click(screen.getByText('Nested book route'));
    await screen.findByRole('heading', { name: 'Add book' });
    fireEvent.click(screen.getByText('Cancel', { selector: 'a' }));
    await screen.findByRole('heading', { name: 'Log reading' });
    expect((screen.getByLabelText('Start Date') as HTMLInputElement).value).toBe('2026-10-05');
    expect((screen.getByLabelText('Format') as HTMLSelectElement).value).toBe('Kindle');
    expect(fetchMock).not.toHaveBeenCalled();
});

it('keeps correction controls while omitting deletion and catalog editing', async () => {
    app('/readings/2/edit');
    await screen.findByRole('heading', { name: 'Edit reading' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete reading' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
});

it('returns a new author into a preserved book draft and saves the book locally', async () => {
    app('/books/new', <Link to="/authors/new?returnTo=%2Fbooks%2Fnew&selectCreated=true">Nested author route</Link>);
    await screen.findByRole('heading', { name: 'Add book' });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Phone book' } });
    fireEvent.change(screen.getByLabelText('Pages'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Science fiction' } });
    fireEvent.click(screen.getByText('Nested author route'));
    await screen.findByRole('heading', { name: 'Add author' });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'NewWriter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Add book' });
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Phone book');
    await waitFor(()=>expect((screen.getByLabelText('Author') as HTMLInputElement).value).toBe('NewWriter'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findAllByText('Phone book');
    expect(fetchMock).not.toHaveBeenCalled();
});

it('confirms export, pauses editing, and shares the identical saved file again', async () => {
    app('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Export for laptop' }));
    expect(shareOutbound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export and pause editing' }));
    await screen.findByRole('button', { name: 'Share export again' });
    await waitFor(() => expect(shareOutbound).toHaveBeenCalledTimes(1));
    const first = vi.mocked(shareOutbound).mock.calls[0][0];
    fireEvent.click(screen.getByRole('button', { name: 'Share export again' }));
    await waitFor(() => expect(shareOutbound).toHaveBeenCalledTimes(2));
    expect(vi.mocked(shareOutbound).mock.calls[1][0]).toBe(first);
});
it('retains the frozen export and paused state if sharing fails', async () => {
    vi.mocked(shareOutbound).mockRejectedValueOnce(new Error('Sharing cancelled'));
    app('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Export for laptop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export and pause editing' }));
    await screen.findByText('Sharing cancelled');
    expect(screen.getByRole('button', { name: 'Share export again' })).toBeTruthy();
});

it('opens the laptop file picker and disables selection while validating', async () => {
    app('/settings');
    const button = await screen.findByRole('button', { name: 'Choose laptop file' });
    const input = screen.getByLabelText('Laptop JSON file') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
    const file = new File(['{}'], 'refresh.json', { type: 'application/json' });
    let finish!: (bytes: ArrayBuffer) => void;
    file.arrayBuffer = () => new Promise(resolve => { finish = resolve; });
    fireEvent.change(input, { target: { files: [file] } });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(input.disabled).toBe(true);
    finish(new TextEncoder().encode('invalid JSON').buffer);
    await screen.findByRole('alert');
    expect((button as HTMLButtonElement).disabled).toBe(false);
});

function CurrentSearch() {
    return <output aria-label="Current filters">{useLocation().search}</output>;
}
it.each([
    ['/?year=2026&q=Dispossessed&sort=title&order=asc', 'Search title', 'The Dispossessed', 'Kindred'],
    ['/books?search=Dispossessed&sort=title&order=asc', 'Search books', 'The Dispossessed', 'Kindred'],
    ['/?year=2026&q=Dispossessed&sort=rating&order=asc', 'Search title', 'The Dispossessed', 'Kindred'],
    ['/books?search=Dispossessed&sort=rating&order=asc', 'Search books', 'The Dispossessed', 'Kindred'],
    ['/authors?q=Ursula&sort=name&order=asc', 'Search authors', 'Ursula', 'Octavia'],
])('preserves filters, sorting, and rendered content across layout changes: %s', async (path, searchLabel, included, excluded) => {
    let desktop = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
        get matches() { return desktop; },
        addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    }));
    const restore = vi.fn(() => {
        // The selected layout must exist before a pending scroll return is consumed.
        expect(screen.queryByText('Loading list…')).toBeNull();
        expect(desktop ? screen.queryByRole('table') : screen.queryByRole('searchbox', { name: searchLabel })).toBeTruthy();
    });
    app(path, <CurrentSearch />, restore);
    await screen.findByRole('searchbox', { name: searchLabel });
    await waitFor(() => expect(screen.queryByText(excluded, { exact: false })).toBeNull());
    expect(screen.getAllByText(included, { exact: false }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).toBeNull();
    const search = screen.getByLabelText('Current filters').textContent;
    act(() => { desktop = true; listeners.forEach(listener => listener()); });
    await screen.findByRole('table');
    expect(screen.queryByRole('searchbox', { name: searchLabel })).toBeNull();
    expect(screen.getByLabelText('Current filters').textContent).toBe(search);
    expect(screen.getAllByRole('columnheader').some(header => header.getAttribute('aria-sort') === 'ascending')).toBe(true);
    act(() => { desktop = false; listeners.forEach(listener => listener()); });
    await screen.findByRole('searchbox', { name: searchLabel });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByLabelText('Current filters').textContent).toBe(search);
    expect(screen.getAllByText(included, { exact: false }).length).toBeGreaterThan(0);
    expect(restore).toHaveBeenCalled();
});

it('loads Settings with recovery protection before a library is initialized', async () => {
    const reads = vi.fn();
    state.storage = { ...state.storage, info: async () => ({ deviceId: uuid(4) }), reads };
    app('/');
    await screen.findByRole('button', { name: 'Choose laptop file' });
    expect(screen.getByText('Import a laptop snapshot to browse your library offline.', { exact: false })).toBeTruthy();
    expect(reads).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
    ['/?year=2026&genreId=1&page=2', 'Search title'],
    ['/books?category=Fiction&page=2', 'Search books'],
])('selects both rating directions and preserves filters: %s', async (path, searchLabel) => {
    const reads = await (state.storage as { reads: () => Promise<Awaited<ReturnType<typeof createSqliteReadData>>> }).reads();
    const bookList = reads.books.list.bind(reads.books);
    const readingList = reads.readings.list.bind(reads.readings);
    const list = path.startsWith('/books')
        ? vi.spyOn(reads.books, 'list').mockImplementation(async params => ({ ...await bookList(params), total: 50 }))
        : vi.spyOn(reads.readings, 'list').mockImplementation(async params => ({ ...await readingList(params), total: 50 }));
    app(path, <CurrentSearch />);
    await screen.findByRole('searchbox', { name: searchLabel });
    for (const [order, label] of [['desc', 'Rating: High to low'], ['asc', 'Rating: Low to high']]) {
        fireEvent.click(await screen.findByRole('button', { name: /Filters & sort/ }));
        fireEvent.click(await screen.findByRole('button', { name: order === 'desc' ? (path.startsWith('/books') ? 'Title: A-Z' : 'Default') : 'Rating: High to low' }));
        fireEvent.click(await screen.findByRole('menuitemradio', { name: label }));
        await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'rating', order })));
        const params = new URLSearchParams(screen.getByLabelText('Current filters').textContent ?? '');
        expect(params.get('sort')).toBe('rating');
        expect(params.get('order')).toBe(order);
        expect(params.has('page')).toBe(false);
        expect(params.get(path.startsWith('/books') ? 'category' : 'genreId')).toBe(path.startsWith('/books') ? 'Fiction' : '1');
        await screen.findByRole('searchbox', { name: searchLabel });
        fireEvent.click(await screen.findByRole('button', { name: /Filters & sort/ }));
        expect(await screen.findByRole('button', { name: label })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    }
    expect(fetchMock).not.toHaveBeenCalled();
});

it('shows reinstall guidance without hiding the preserved-library explanation', async()=>{
    const message='This update needs a fresh laptop snapshot. Complete any old transfer, then uninstall and reinstall the updated app and import a version-2 snapshot. Your existing phone data has not been changed.';
    state.storage={...state.storage,info:async()=>{throw new Error(message);}};
    app('/');
    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(fetchMock).not.toHaveBeenCalled();
});

it('opens Admin from the hamburger and creates a country entirely offline',async()=>{
    app('/');
    fireEvent.click(await screen.findByRole('button',{name:'Open menu'}));
    fireEvent.click(await screen.findByRole('menuitem',{name:'Admin'}));
    await screen.findByRole('heading',{name:'Admin'});
    fireEvent.click(screen.getByRole('button',{name:'Countries'}));
    await screen.findByRole('heading',{name:'Countries'});
    fireEvent.change(screen.getByLabelText('New country name'),{target:{value:'France'}});
    fireEvent.click(screen.getByRole('button',{name:'Add'}));
    await screen.findByText('France');
    expect(fetchMock).not.toHaveBeenCalled();
});

it('stores independent reading preferences across restarts', async () => {
    const first = app('/settings');
    const history = await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Show Pre-2022 controls' });
    const rankings = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Show graphic novel ranking controls' });
    expect(history.checked).toBe(true);
    expect(rankings.checked).toBe(true);
    fireEvent.click(history);
    expect(rankings.checked).toBe(true);
    first.unmount();
    app('/settings');
    expect((await screen.findByRole<HTMLInputElement>('checkbox', { name: 'Show Pre-2022 controls' })).checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Show graphic novel ranking controls' }).checked).toBe(true);
    localStorage.removeItem('reading-tracker.show-pre-2022');
});
