import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { FormLink } from './FormLink';
import { FormCancelLink } from './FormCancelLink';
import { MobilePageNavigation } from './MobilePageNavigation';
import { useFormReturn } from '@/hooks/useFormReturn';

afterEach(cleanup);
function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>History back</button>;
}
function Edit() {
  const leave = useFormReturn();
  return <><MobilePageNavigation /><FormCancelLink to="/books/1">Form cancel</FormCancelLink>
    <button onClick={() => leave('/books/1')}>Save</button></>;
}
it.each(['Form cancel', 'Cancel', 'Save'])('%s returns to existing details, then Back reaches the list', action => {
  render(<MemoryRouter initialEntries={['/books?tagId=2']}><Routes>
    <Route path="/books" element={<Link to="/books/1">Open book</Link>} />
    <Route path="/books/1" element={<><FormLink to="/books/1/edit">Edit</FormLink><Back /></>} />
    <Route path="/books/1/edit" element={<Edit />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByText('Open book'));
  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText(action));
  expect(screen.getByText('Edit')).toBeDefined();
  fireEvent.click(screen.getByText('History back'));
  expect(screen.getByText('Open book')).toBeDefined();
});
