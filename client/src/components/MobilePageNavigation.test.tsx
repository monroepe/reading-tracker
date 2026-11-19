import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { MobilePageNavigation } from './MobilePageNavigation';
import { CompanionContext } from '@/data/capabilities';

afterEach(cleanup);
it('returns direct book entries to Books', () => {
  render(<MemoryRouter initialEntries={['/books/12']}><Routes>
    <Route path="/books/:id" element={<MobilePageNavigation />} />
    <Route path="/books" element={<p>Book list</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('Book list')).toBeDefined();
});
it('cancels forms to the supplied return destination', () => {
  render(<MemoryRouter initialEntries={['/readings/new?returnTo=%2Fbooks%3FtagId%3D2']}><Routes>
    <Route path="/readings/new" element={<MobilePageNavigation />} />
    <Route path="/books" element={<p>Book list</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Book list')).toBeDefined();
});
it('keeps Android controls visible beyond the mobile breakpoint', () => {
  render(<MemoryRouter initialEntries={['/books/12']}><CompanionContext value={true}><MobilePageNavigation /></CompanionContext></MemoryRouter>);
  expect(screen.getByRole('button').parentElement?.className).not.toContain('md:hidden');
});
it('does not add controls to top-level pages', () => {
  render(<MemoryRouter initialEntries={['/books']}><MobilePageNavigation /></MemoryRouter>);
  expect(screen.queryByRole('button')).toBeNull();
});
