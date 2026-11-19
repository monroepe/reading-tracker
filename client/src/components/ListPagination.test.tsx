import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ListPagination } from './ListPagination';
import { useListPagination } from '@/hooks/useListPagination';
function Example() {
  const pagination = useListPagination();
  const location = useLocation();
  return <><output>{location.search}</output><ListPagination pagination={pagination} query={{ data: { total: 61, page: pagination.page, pageSize: pagination.pageSize }, isFetching: false, isError: false, isPlaceholderData: false }} /></>;
}
it('shows totals and permits direct page selection while retaining filters', () => {
  render(<MemoryRouter initialEntries={['/books?q=test']}><Example /></MemoryRouter>);
  expect(screen.getByText('1–25 of 61')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Page'), { target: { value: '3' } });
  expect(screen.getByText('51–61 of 61')).toBeTruthy();
  expect(screen.getByText('?q=test&page=3')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('changes desktop page size and resets the page while retaining filters', () => {
  render(<MemoryRouter initialEntries={['/books?q=test&page=2']}><Example /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Records per page'), { target: { value: '50' } });
  expect(screen.getByText('1–50 of 61')).toBeTruthy();
  expect(screen.getByText('?q=test&pageSize=50')).toBeTruthy();
  expect(screen.getAllByRole('option').map(option => option.textContent)).toContain('100');
});
it('uses 25 on mobile and hides the range and size selector', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  render(<MemoryRouter initialEntries={['/books?pageSize=100']}><Example /></MemoryRouter>);
  expect(screen.queryByLabelText('Records per page')).toBeNull();
  expect(screen.queryByText(/of 61/)).toBeNull();
  expect(screen.getAllByRole('option')).toHaveLength(3);
});
