import { createContext } from 'react';
import { matchPath, type Location } from 'react-router';

export interface ScrollReturnContextValue {
  origin?: () => string | undefined;
  capture: (location: Location) => void;
  restore: (location: Location) => void;
}

// Optional so isolated pages and links can also render without the provider.
export const ScrollReturnContext = createContext<ScrollReturnContextValue | null>(null);

export function locationUrl(location: Location): string {
  return location.pathname + location.search + location.hash;
}

export function isFormPage(pathname: string): boolean {
  return [
    '/books/new', '/books/:id/edit',
    '/authors/new', '/authors/:id/edit',
    '/readings/new', '/readings/:id/edit', '/readings/:id/finish',
  ].some((path) => matchPath(path, pathname) !== null);
}

export function isScrollReturnPage(pathname: string): boolean {
  return !isFormPage(pathname) && [
    '/', '/books', '/books/:id', '/authors', '/authors/:id',
  ].some((path) => matchPath(path, pathname) !== null);
}
