import { lazy } from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { PageBoundary } from './PageBoundary';

afterEach(cleanup);

it('keeps surrounding navigation available while a page loads', async () => {
  let resolve!: (value: { default: () => React.ReactNode }) => void;
  const Page = lazy(() => new Promise<{ default: () => React.ReactNode }>(done => { resolve = done; }));
  render(<MemoryRouter><nav>Navigation</nav><PageBoundary><Page /></PageBoundary></MemoryRouter>);
  expect(screen.getByRole('status').textContent).toBe('Loading page…');
  expect(screen.getByText('Navigation')).toBeTruthy();
  await act(async () => { resolve({ default: () => <p>Page ready</p> }); });
  expect(screen.getByText('Page ready')).toBeTruthy();
});

it('offers recovery when a page module fails', async () => {
  const logging = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const Page = lazy(() => Promise.reject(new Error('Missing chunk')));
    render(<MemoryRouter><PageBoundary><Page /></PageBoundary></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  } finally { logging.mockRestore(); }
});
