import { PageBoundary } from '@/components/PageBoundary';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { TransfersPage } from './TransfersPage';
import { TransferFlow } from './TransferFlow';
import { ImportReviewPage } from './ImportReviewPage';
import { api } from '@/api/client';
import type { Preview, Exchange, Item } from './transferReview';
vi.mock('@/api/client', async importOriginal => ({ ...await importOriginal<typeof import('@/api/client')>(), api: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const tags: Item = { changeId: 'tags', action: 'insert', reason: 'New record', incoming: { entityType: 'bookTags', entityId: 'selection', data: { bookId: 'book', tagIds: ['epic'] } }, local: null, candidates: [] };
const exchange: Exchange = { changes: [{ changeId: 'tags', baseline: null, record: tags.incoming }] };
const preview: Preview = { previewDigest: 'digest', items: [tags], references: { 'books:book': 'Words of Radiance', 'tags:epic': 'epic' }, referenceIssues: [], hasBlockingIssues: false };
function setup(path = '/transfers') {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[path]}><Routes><Route path="/transfers" element={<TransferFlow><PageBoundary><Outlet /></PageBoundary></TransferFlow>}><Route index element={<TransfersPage />} /><Route path="review" element={<ImportReviewPage />} /></Route></Routes></MemoryRouter></QueryClientProvider>);
}
async function upload(payload = exchange) {
  const file = new File(['{}'], 'phone.json');
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(payload) });
  fireEvent.change(screen.getByLabelText('Phone JSON file'), { target: { files: [file] } });
  await screen.findByRole('heading', { name: /Review phone changes|Phone changes saved/ });
}
it('opens one file picker and rejects malformed files without an API call', async () => {
  setup();
  const input = screen.getByLabelText('Phone JSON file') as HTMLInputElement;
  const click = vi.spyOn(input, 'click');
  fireEvent.click(screen.getByRole('button', { name: 'Choose phone file' }));
  expect(click).toHaveBeenCalledOnce();
  const file = new File(['bad'], 'bad.json'); Object.defineProperty(file, 'text', { value: async () => 'bad' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('alert');
  expect(api).not.toHaveBeenCalled(); expect(input.value).toBe('');
});
it('opens the dedicated real review, explains tag additions, and saves the exact file', async () => {
  vi.mocked(api).mockResolvedValueOnce(preview).mockResolvedValueOnce({ transferId: 'round', outcomes: [{ action: 'applied' }] });
  setup(); await upload();
  expect(screen.getByText('Words of Radiance')).toBeTruthy();
  expect(screen.getAllByText('Tags updated')[0]).toBeTruthy();
  expect(screen.getByText('Laptop: No tags')).toBeTruthy();
  expect(screen.queryByText('New book')).toBeNull();
  expect((screen.getByRole('button', { name: 'Import changes' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Import changes' }));
  await screen.findByText('Saved on the laptop.');
  expect(api).toHaveBeenLastCalledWith('/transfers/imports/commit', { method: 'POST', body: { exchange, matches: [], skippedBookIds: [], previewDigest: 'digest', choices: [] } });
  expect(screen.getByRole('button', { name: 'Download phone refresh' })).toBeTruthy();
});
it('cancels without saving and redirects a review with no session', async () => {
  setup('/transfers/review');
  expect(screen.getByRole('heading', { name: 'Transfers' })).toBeTruthy();
  vi.mocked(api).mockResolvedValueOnce(preview);
  await upload();
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
  expect(screen.getByRole('heading', { name: 'Transfers' })).toBeTruthy();
  expect(api).toHaveBeenCalledTimes(1);
});
it('repreviews a whole-book skip, then commits the original exchange and skip decision', async () => {
  vi.mocked(api).mockResolvedValueOnce(preview)
    .mockResolvedValueOnce({ ...preview, previewDigest: 'skipped', discardedChangeIds: ['tags'], items: [{ ...tags, action: 'skip', reason: 'Discarded phone changes' }] })
    .mockResolvedValueOnce({ transferId: 'round', outcomes: [{ action: 'discarded' }] });
  setup(); await upload();
  fireEvent.click(screen.getByRole('button', { name: 'Skip this book and discard its phone changes' }));
  await screen.findByText('Skipped — phone changes discarded');
  expect(api).toHaveBeenLastCalledWith('/transfers/imports/preview', { method: 'POST', body: { exchange, matches: [], skippedBookIds: ['book'] } });
  fireEvent.click(screen.getByRole('button', { name: 'Import changes' }));
  await screen.findByText('Saved on the laptop.');
  expect(api).toHaveBeenLastCalledWith('/transfers/imports/commit', { method: 'POST', body: { exchange, matches: [], skippedBookIds: ['book'], previewDigest: 'skipped', choices: [] } });
});
it('retries the identical request after an unconfirmed import', async () => {
  vi.mocked(api).mockResolvedValueOnce(preview).mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({ transferId: 'round', outcomes: [] });
  setup(); await upload(); fireEvent.click(screen.getByRole('button', { name: 'Import changes' }));
  await screen.findByRole('alert');
  expect((screen.getAllByRole('button', { name: 'Cancel' })[0] as HTMLButtonElement).disabled).toBe(true);
  const request = vi.mocked(api).mock.calls[1];
  fireEvent.click(screen.getByRole('button', { name: 'Check status / Retry import' }));
  await screen.findByText('Saved on the laptop.');
  expect(vi.mocked(api).mock.calls[2]).toEqual(request);
});
it('refreshes stale data and handles an already completed file', async () => {
  vi.mocked(api).mockResolvedValueOnce(preview).mockRejectedValueOnce(new Error('Preview is stale')).mockResolvedValueOnce({ ...preview, previewDigest: 'fresh' });
  setup(); await upload(); fireEvent.click(screen.getByRole('button', { name: 'Import changes' }));
  await screen.findByText('Laptop data changed. Review the refreshed changes and make your choices again.');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Import changes' }) as HTMLButtonElement).disabled).toBe(false));
});
it('keeps a failed repreview from enabling a stale import', async () => {
  vi.mocked(api).mockResolvedValueOnce(preview).mockRejectedValueOnce(new Error('Unavailable'));
  setup(); await upload();
  fireEvent.click(screen.getByRole('button', { name: 'Skip this book and discard its phone changes' }));
  await screen.findByRole('button', { name: 'Retry review' });
  expect((screen.getByRole('button', { name: 'Import changes' }) as HTMLButtonElement).disabled).toBe(true);
});
it('matches a possible duplicate, keeps the decision visible, and enables saving only after repreview', async () => {
  const book = { entityType: 'books', entityId: 'phone-book', data: { title: 'The Way of Kings', pageCount: 1007 } };
  const local = { ...book, entityId: 'laptop-book' };
  const item: Item = { changeId: 'book-change', action: 'match', reason: 'Match required', incoming: book, local: null, candidates: [local] };
  const file: Exchange = { changes: [{ changeId: item.changeId, baseline: null, record: book }] };
  vi.mocked(api).mockResolvedValueOnce({ ...preview, items: [item] }).mockResolvedValueOnce({ ...preview, items: [{ ...item, local, action: 'skip', reason: 'Catalog identity matched; laptop metadata retained' }], aliases: [{ entityType: 'books', incomingId: 'phone-book', localId: 'laptop-book' }] });
  setup(); await upload(file);
  expect((screen.getByRole('button', { name: 'Import changes' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/Use existing book and import its changes:/));
  await screen.findByText('Decision made');
  expect(api).toHaveBeenLastCalledWith('/transfers/imports/preview', { method: 'POST', body: { exchange: file, matches: [{ entityType: 'books', incomingId: 'phone-book', localId: 'laptop-book' }], skippedBookIds: [] } });
  expect((screen.getByRole('button', { name: 'Import changes' }) as HTMLButtonElement).disabled).toBe(false);
});
it('requires a whole tag-selection conflict choice and shows additions and removals', async () => {
  const item = { ...tags, action: 'conflict', reason: 'Diverged', local: { ...tags.incoming, data: { bookId: 'book', tagIds: ['old'] } } };
  vi.mocked(api).mockResolvedValueOnce({ ...preview, references: { ...preview.references, 'tags:old': 'fantasy' }, items: [item] }).mockResolvedValueOnce({ transferId: 'round', outcomes: [] });
  setup(); await upload();
  expect(screen.getByText('fantasy')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Import changes' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Phone'));
  fireEvent.click(screen.getByRole('button', { name: 'Import changes' }));
  await screen.findByText('Saved on the laptop.');
  expect(vi.mocked(api).mock.calls[1][1]?.body).toMatchObject({ choices: [{ changeId: 'tags', choice: 'incoming' }] });
});
it('offers refresh recovery for an already imported file without another commit', async () => {
  vi.mocked(api).mockResolvedValueOnce({ ...preview, completedResult: { transferId: 'round', outcomes: [] } });
  setup(); await upload();
  expect(await screen.findByText('Saved on the laptop.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Import changes' })).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});
it('keeps Cancel usable during a read-only repreview and ignores its late result', async () => {
  let finish!: (value: Preview) => void;
  vi.mocked(api).mockResolvedValueOnce(preview).mockImplementationOnce(() => new Promise<Preview>(resolve => { finish = resolve; }));
  setup(); await upload();
  fireEvent.click(screen.getByRole('button', { name: 'Skip this book and discard its phone changes' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
  expect(screen.getByRole('heading', { name: 'Transfers' })).toBeTruthy();
  finish(preview);
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Review phone changes' })).toBeNull());
});

function drop(files: File[]) {
  const zone = screen.getByText(/Drag and drop your phone JSON/).parentElement!;
  fireEvent.drop(zone, { dataTransfer: { files, types: ['Files'] } });
}
it('opens review from a dropped file', async () => {
  vi.mocked(api).mockResolvedValueOnce(preview);
  setup();
  const file = new File(['{}'], 'phone.json');
  Object.defineProperty(file, 'text', { value: async () => JSON.stringify(exchange) });
  drop([file]);
  await screen.findByRole('heading', { name: 'Review phone changes' });
  expect(api).toHaveBeenCalledOnce();
});
it('rejects multiple, oversized, and malformed dropped files', async () => {
  setup();
  const file = new File(['bad'], 'bad.json');
  Object.defineProperty(file, 'text', { value: async () => 'bad' });
  drop([file, file]);
  expect(screen.getByRole('alert').textContent).toContain('one phone');
  Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024, configurable: true });
  drop([file]);
  await screen.findByText('File exceeds the 10 MiB limit');
  Object.defineProperty(file, 'size', { value: 3 });
  drop([file]);
  await waitFor(() => expect(screen.getByRole('alert').textContent).not.toContain('10 MiB'));
  expect(api).not.toHaveBeenCalled();
});
it('clears highlighting, ignores text, and blocks drops during processing', async () => {
  setup();
  const zone = screen.getByText(/Drag and drop your phone JSON/).parentElement!;
  fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
  expect(zone.className).toContain('bg-muted');
  fireEvent.dragLeave(zone);
  expect(zone.className).not.toContain('bg-muted');
  drop([]);
  expect(api).not.toHaveBeenCalled();
  const file = new File(['{}'], 'phone.json');
  const read = vi.fn(() => new Promise<string>(() => {}));
  Object.defineProperty(file, 'text', { value: read });
  drop([file]); drop([file]);
  expect(read).toHaveBeenCalledOnce();
  expect(zone.className).not.toContain('bg-muted');
});
