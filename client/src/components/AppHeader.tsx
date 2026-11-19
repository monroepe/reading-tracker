import type { ReactNode } from 'react';
import { BookBookmarkIcon } from 'lucide-react';
import { NavLink } from 'react-router';

export function AppHeader({ analytics = true, actions, brandOnly = false }: { analytics?: boolean; actions?: ReactNode; brandOnly?: boolean }) {
  return <header className="app-header">
    <BookBookmarkIcon aria-hidden="true" className="size-7 shrink-0" />
    {brandOnly ? <span className="font-semibold">Reading Log</span> : <nav className="nav">
      <NavLink to="/" end>Log</NavLink>
      <NavLink to="/books">Books</NavLink>
      <NavLink to="/authors">Authors</NavLink>
      {analytics && <NavLink to="/analytics">Analytics</NavLink>}
    </nav>}
    <span className="spacer" />
    {actions}
  </header>;
}
