import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { BookForm } from './BookForm';

const state = vi.hoisted(() => ({ role: 'admin', isPending: false, isError: false }));
vi.mock('@/features/auth/useAuth', () => ({ useMe: () => ({ data: { role: state.role } }) }));
vi.mock('@/features/authors/api/useAuthors', () => ({ useAuthors: () => ({ data: [] }) }));
vi.mock('../../genres/useGenres', () => ({ useGenres: () => ({ ...state, data: [{ id: 1, name: 'Fantasy' }, { id: 2, name: 'History' }] }) }));
vi.mock('../../tags/TagPicker', () => ({ TagPicker: () => null }));
afterEach(() => { cleanup(); state.role = 'admin'; state.isPending = false; state.isError = false; });

function setup() {
  const submit = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><BookForm heading="Edit book" submitLabel="Save" isPending={false} error={null} onSubmit={submit}
    initial={{ title: 'Book', author: { id: 1, label: 'Author' }, coAuthors: '', genreName: 'Fantasy', tags: [], category: 'Fiction', pageCount: 100 }} /></MemoryRouter></QueryClientProvider>);
  return submit;
}
it('shows the initial genre and submits a case-insensitive existing match', () => {
  const submit = setup();
  expect((screen.getByLabelText('Genre') as HTMLInputElement).value).toBe('Fantasy');
  fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'fantasy' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(submit.mock.calls[0][0].genre).toEqual({ id: 1 });
});
it('requires explicit creation before submitting an unknown genre', () => {
  const submit = setup();
  fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'New genre' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('button', {name: 'Create genre “New genre”'})).toBeTruthy();
});
it('prevents non-admins from submitting unknown genres', () => {
  state.role = 'user';
  const submit = setup();
  fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Unknown' } });
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  expect(submit).not.toHaveBeenCalled();
});
it.each(['isPending', 'isError'] as const)('disables genre for non-admins when %s', (key) => {
  state.role = 'user'; state[key] = true;
  setup();
  expect((screen.getByLabelText('Genre') as HTMLInputElement).disabled).toBe(true);
  if (key === 'isError') expect(screen.getByRole('alert').textContent).toContain('Unable to load genres');
});
