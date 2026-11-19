import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LoginPage } from './LoginPage';
import { AppHeader } from '@/components/AppHeader';

const state = vi.hoisted(() => ({
  mutate: vi.fn(),
  pending: false,
  error: false,
  authenticated: false,
}));
vi.mock('./useAuth', () => ({
  useMe: () => ({ isSuccess: true, data: state.authenticated ? { id: 1 } : null }),
  useLogin: () => ({ mutate: state.mutate, isPending: state.pending, isError: state.error, error: new Error('Invalid credentials') }),
}));
afterEach(cleanup);
beforeEach(() => {
  state.mutate.mockClear();
  state.pending = state.error = state.authenticated = false;
});
function renderLogin() {
  render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<p>Reading list</p>} />
  </Routes></MemoryRouter>);
}
it('shows the brand and submits labeled credentials', () => {
  renderLogin();
  expect(screen.getByText('Reading Log')).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(state.mutate).toHaveBeenCalledWith({ email: 'reader@example.com', password: 'secret' });
});
it('disables submission while pending', () => {
  state.pending = true;
  renderLogin();
  expect((screen.getByRole('button', { name: 'Logging in…' }) as HTMLButtonElement).disabled).toBe(true);
});
it('announces login errors', () => {
  state.error = true;
  renderLogin();
  expect(screen.getByRole('alert').textContent).toBe('Invalid credentials');
});
it('redirects signed-in users', () => {
  state.authenticated = true;
  renderLogin();
  expect(screen.getByText('Reading list')).toBeTruthy();
});
it('preserves default header navigation', () => {
  render(<MemoryRouter><AppHeader /></MemoryRouter>);
  for (const name of ['Log', 'Books', 'Authors', 'Analytics']) {
    expect(screen.getByRole('link', { name })).toBeTruthy();
  }
});
