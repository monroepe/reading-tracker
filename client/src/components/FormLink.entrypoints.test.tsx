import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { AuthorListItem, Book, Reading } from '@/api/types';
import { DataTable } from '@/components/data-table/DataTable';
import { ReadingCard } from '@/features/readings/components/ReadingCard';
import { readingColumns } from '@/features/readings/components/readingColumns';
import { BookCard } from '@/features/books/components/BookCard';
import { bookColumns } from '@/features/books/components/bookColumns';
import { AuthorCard } from '@/features/authors/components/AuthorCard';
import { authorColumns } from '@/features/authors/components/authorColumns';

vi.mock('@/features/auth/AdminOnly', () => ({ AdminOnly: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/books/api/useBookReadings', () => ({ useBookReadings: () => ({}) }));
vi.mock('@/features/authors/api/useAuthorBooks', () => ({ useAuthorBooks: () => ({}) }));

const author: AuthorListItem = {
  id: 3, firstName: 'Ann', middleName: '', lastName: 'Smith', country: null, gender: null, bookCount: 1,
};
const book: Book = {
  tags: [], id: 2, title: 'Book', coAuthors: null, category: 'Fiction', pageCount: 100,
  author, genre: { id: 1, name: 'Fiction' }, lastReading: null,
};
const reading: Reading = {
  id: 1, book, author, genre: book.genre, startedOn: '2023-01-01', finishedOn: null,
  dateUncertain: false, abandoned: false, format: 'Print', rating: null, review: null, days: null,
};
const cases = [
  { label: 'reading card', content: <ReadingCard reading={reading} />, action: 'Edit', target: '/readings/1/edit' },
  { label: 'reading table edit', content: <DataTable columns={readingColumns} data={[reading]} />, action: 'Edit', target: '/readings/1/edit' },
  { label: 'reading table finish', content: <DataTable columns={readingColumns} data={[reading]} />, action: 'Finish', target: '/readings/1/finish' },
  { label: 'book card', content: <BookCard book={book} />, action: 'Edit', target: '/books/2/edit' },
  { label: 'book table', content: <DataTable columns={bookColumns} data={[book]} />, action: 'Edit', target: '/books/2/edit' },
  { label: 'author card', content: <AuthorCard author={author} />, action: 'Edit', target: '/authors/3/edit' },
  { label: 'author table', content: <DataTable columns={authorColumns} data={[author]} />, action: 'Edit', target: '/authors/3/edit' },
];
function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname + location.search}</output>;
}
afterEach(cleanup);
it.each(cases)('$label opens the form with its originating URL', ({ content, action, target }) => {
  const origin = '/?year=2023&sort=title&order=asc&q=Book&page=3#rows';
  render(<MemoryRouter initialEntries={[origin]}><Routes>
    <Route path="/" element={content} />
    <Route path="*" element={<Destination />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: action }));
  const destination = new URL(screen.getByTestId('destination').textContent!, 'http://localhost');
  expect(destination.pathname).toBe(target);
  expect(destination.searchParams.get('returnTo')).toBe(origin);
});
