import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Reading } from '@/api/types';
import { EditReadingPage } from './pages/EditReadingPage';
import { ReadingsPage } from './pages/ReadingsPage';
import { BookReadingCard } from '../books/components/BookReadingCard';

const { mutate, list, state } = vi.hoisted(() => ({ mutate: vi.fn(), list: vi.fn(), state: { uncertain: true, error: null as Error | null } }));
const imported: Reading = {
  id: 1, startedOn: '2021-11-30', finishedOn: '2021-12-30', dateUncertain: true,
  abandoned: false, format: 'Kindle', rating: 8, review: null, days: null,
  book: { id: 2, title: 'Imported book', coAuthors: null, category: 'Fiction', pageCount: 100 },
  author: { id: 3, firstName: 'Ann', middleName: '', lastName: 'Smith' },
  genre: { id: 4, name: 'Fantasy' },
};
vi.mock('./api/useReading', () => ({ useReading: () => ({ data: { ...imported, dateUncertain: state.uncertain } }) }));
vi.mock('./api/useUpdateReading', () => ({ useUpdateReading: () => ({ mutate, error: state.error }) }));
vi.mock('./api/useDeleteReading', () => ({ useDeleteReading: () => ({}) }));
vi.mock('@/features/books/api/useBooks', () => ({ useBooks: () => ({ data: [] }) }));
vi.mock('@/features/books/api/useBook', () => ({ useBook: () => ({ data: { tags: [] } }) }));
vi.mock('../tags/TagPicker', () => ({ TagPicker: () => null }));
vi.mock('@/features/genres/useGenres', () => ({ useGenres: () => ({ data: [] }) }));
vi.mock('@/features/authors/api/useAuthor', () => ({ useAuthor: () => ({}) }));
vi.mock('./api/useReadings', () => ({ useReadingList: (params: unknown) => { list(params); return { isSuccess: true, data: { data: [imported] } }; } }));
afterEach(cleanup);
beforeEach(() => { state.uncertain = true; state.error = null; });

function editForm() {
  return render(<MemoryRouter initialEntries={['/readings/1/edit']}><Routes>
    <Route path="/readings/:id/edit" element={<EditReadingPage />} />
  </Routes></MemoryRouter>);
}
it('hides both imported date fields and omits dates and metadata when saving other fields', () => {
  const { container } = editForm();
  expect(screen.queryByLabelText('Start Date')).toBeNull();
  expect(screen.queryByLabelText('Finish Date')).toBeNull();
  expect(container.textContent).not.toContain('2021-11-30');
  expect(container.textContent).not.toContain('2021-12-30');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Rating' }), { target: { value: '9' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
  expect(mutate.mock.calls[0][0]).toEqual({
    values: { bookId: 2, format: 'Kindle', rating: 9, review: null }, tags: [],
  });
});
it('retains normal date editing for specific-date readings', () => {
  state.uncertain = false;
  editForm();
  expect(screen.getByLabelText('Start Date')).toBeTruthy();
  expect(screen.getByLabelText('Finish Date')).toBeTruthy();
});
it('navigates from 2022 to Pre-2022 and back, retaining other filters', () => {
  render(<MemoryRouter initialEntries={['/?year=2022&format=Kindle']}><ReadingsPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
  expect(screen.getByRole('heading', { name: 'Pre-2022' })).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Previous year' }) as HTMLButtonElement).disabled).toBe(true);
  expect(list.mock.calls.at(-1)?.[0]).toMatchObject({ year: 'pre-2022', format: 'Kindle' });
  fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
  expect(screen.getByRole('heading', { name: '2022' })).toBeTruthy();
  expect(list.mock.calls.at(-1)?.[0]).toMatchObject({ year: 2022, format: 'Kindle' });
});
it('hides both placeholders in book history', () => {
  const { container } = render(<BookReadingCard reading={imported} />);
  expect(screen.getByText('Date uncertain')).toBeTruthy();
  expect(container.textContent).not.toContain('2021-11-30');
  expect(container.textContent).not.toContain('2021-12-30');
});
it('hides date and pace columns only for Pre-2022 and restores them for 2022', async () => {
  render(<MemoryRouter initialEntries={['/?year=pre-2022']}><ReadingsPage /></MemoryRouter>);
  await screen.findByRole('table');
  const headers = () => screen.getAllByRole('columnheader').map((header) => header.textContent);
  expect(headers()).toEqual(expect.arrayContaining(['Title', 'Author', 'Genre', 'Format', 'Rating']));
  for (const label of ['Finished', 'Days', 'Pages/day']) {
    expect(headers().some((header) => header?.includes(label))).toBe(false);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
  for (const label of ['Finished', 'Days', 'Pages/day']) {
    expect(headers().some((header) => header?.includes(label))).toBe(true);
  }
  fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
  for (const label of ['Finished', 'Days', 'Pages/day']) {
    expect(headers().some((header) => header?.includes(label))).toBe(false);
  }
});

it('shows a failed save without clearing the reading form', () => {
  state.error = new Error('Could not save reading. Try again.');
  editForm();
  expect(screen.getByRole('alert').textContent).toBe('Could not save reading. Try again.');
  expect((screen.getByRole('spinbutton', { name: 'Rating' }) as HTMLInputElement).value).toBe('8');
});

vi.mock('@/features/auth/useAuth', () => ({ useMe: () => ({ data: { role: 'admin' } }) }));
