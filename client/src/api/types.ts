import type { ReadingPeriod } from '@/lib/readingPeriod';

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'user';
}

export type Format = 'Print' | 'Kindle' | 'Audiobook' | 'Graphic Novel';

export type Category = 'Fiction' | 'Non-fiction';

export interface Reading {
  id: number;
  startedOn: string;
  finishedOn: string | null;
  dateUncertain: boolean;
  abandoned: boolean;
  format: Format;
  rating: number | null;
  review: string | null;
  days: number | null;
  book: {
    id: number;
    title: string;
    coAuthors: string | null;
    category: Category;
    pageCount: number;
  };
  author: { id: number; firstName: string; middleName: string; lastName: string };
  genre: { id: number; name: string };
}

export interface Author {
  id: number;
  firstName: string;
  middleName: string;
  lastName: string;
  country: string | null;
  countries?: { id: number; name: string }[];
  gender: string | null;
}

export interface AuthorListItem extends Author {
  bookCount: number;
}

export type BookReading = Pick<
  Reading,
  'id' | 'startedOn' | 'finishedOn' | 'dateUncertain' | 'abandoned' | 'format' | 'rating' | 'review'
>;

export type BookLastReading = BookReading;

export interface AuthorBook {
  id: number;
  title: string;
  coAuthors: string | null;
  category: Category;
  pageCount: number;
  genre: { id: number; name: string };
  readingCount: number;
  lastReading: BookLastReading | null;
}

export interface Book {
  tags: Tag[];
  id: number;
  title: string;
  coAuthors: string | null;
  category: Category;
  pageCount: number;
  author: { id: number; firstName: string; middleName: string; lastName: string };
  genre: { id: number; name: string };
  lastReading: BookLastReading | null;
}

// getBook does not return lastReading, so it is omitted here.
export interface BookDetail extends Omit<Book, 'lastReading'> {
  tags: Tag[];
}

export interface Genre {
  id: number;
  name: string;
}

// List query contract (shared by all server-side tables)

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortOrder = 'asc' | 'desc';

export interface ListParams<TSort extends string> {
  q?: string;
  sort?: TSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

// Authors

export type AuthorSortField = 'name' | 'firstName' | 'country' | 'gender' | 'bookCount';

export interface AuthorListParams extends ListParams<AuthorSortField> {
  country?: string;
  gender?: string;
}

// Books

export type BookSortField = 'title' | 'author' | 'genre' | 'category' | 'pageCount' | 'rating';

export interface BookListParams extends ListParams<BookSortField> {
  /** Matches the book title or the author's name (`q` matches the title only). */
  search?: string;
  authorId?: number;
  genreId?: number;
  category?: Category;
  tagIds?: number[];
}

// Readings (mirrors the server whitelist in readings.schemas.ts)

export type ReadingSortField =
  | 'title'
  | 'author'
  | 'genre'
  | 'category'
  | 'pageCount'
  | 'format'
  | 'startedOn'
  | 'finishedOn'
  | 'days'
  | 'rating';

export interface ReadingListParams extends ListParams<ReadingSortField> {
  authorId?: number;
  year?: ReadingPeriod;
  abandoned?: boolean;
  format?: Format;
  genreId?: number;
  category?: Category;
}

export interface Tag {
  id: number;
  name: string;
}