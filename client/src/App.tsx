import { lazy } from 'react';

import { RequireAdmin } from './features/auth/RequireAdmin';

import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';

import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ReadingsPage } from '@/features/readings/pages/ReadingsPage';

const CatalogPage = lazy(() => import('@/features/admin/CatalogPage').then(m => ({ default: m.CatalogPage })));
const ImportReviewPage = lazy(() => import('./features/transfers/ImportReviewPage').then(module => ({ default: module.ImportReviewPage })));
const TransfersPage = lazy(() => import('./features/transfers/TransfersPage').then(module => ({ default: module.TransfersPage })));
const AdminPage = lazy(() => import('./features/admin/AdminPage').then(module => ({ default: module.AdminPage })));
const AdminTagsPage = lazy(() => import('./features/admin/AdminTagsPage').then(module => ({ default: module.AdminTagsPage })));
const AuthorsPage = lazy(() => import('./features/authors/pages/AuthorsPage').then(module => ({ default: module.AuthorsPage })));
const NewReadingPage = lazy(() => import('./features/readings/pages/NewReadingPage').then(module => ({ default: module.NewReadingPage })));
const EditReadingPage = lazy(() => import('./features/readings/pages/EditReadingPage').then(module => ({ default: module.EditReadingPage })));
const FinishReadingPage = lazy(() => import('./features/readings/pages/FinishReadingPage').then(module => ({ default: module.FinishReadingPage })));
const AddAuthorPage = lazy(() => import('./features/authors/pages/AddAuthorPage').then(module => ({ default: module.AddAuthorPage })));
const EditAuthorPage = lazy(() => import('./features/authors/pages/EditAuthorPage').then(module => ({ default: module.EditAuthorPage })));
const YearInReviewLaunch = lazy(() => import('./features/analytics/YearInReviewPage').then(module => ({ default: module.YearInReviewLaunch })));
const YearInReviewPage = lazy(() => import('./features/analytics/YearInReviewPage').then(module => ({ default: module.YearInReviewPage })));
const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage').then(module => ({ default: module.AnalyticsPage })));
const AuthorDetailPage = lazy(() => import('./features/authors/pages/AuthorDetailPage').then(module => ({ default: module.AuthorDetailPage })));
const AddBookPage = lazy(() => import('./features/books/pages/AddBookPage').then(module => ({ default: module.AddBookPage })));
const BookDetailPage = lazy(() => import('./features/books/pages/BookDetailPage').then(module => ({ default: module.BookDetailPage })));
const BooksPage = lazy(() => import('./features/books/pages/BooksPage').then(module => ({ default: module.BooksPage })));
const EditBookPage = lazy(() => import('./features/books/pages/EditBookPage').then(module => ({ default: module.EditBookPage })));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/countries" element={<CatalogPage kind="countries" />} />
            <Route path="admin/genres" element={<CatalogPage kind="genres" />} />
            <Route path="admin/tags" element={<AdminTagsPage />} />
            <Route path="books/:id/edit" element={<EditBookPage />} />
            <Route path="authors/:id/edit" element={<EditAuthorPage />} />
          </Route>
          <Route path="books/new" element={<AddBookPage />} />
          <Route path="authors/new" element={<AddAuthorPage />} />
          <Route path="transfers">
            <Route index element={<TransfersPage />} />
            <Route path="review" element={<ImportReviewPage />} />
          </Route>
          <Route index element={<ReadingsPage />} />
          <Route path="readings/new" element={<NewReadingPage />} />
          <Route path="readings/:id/edit" element={<EditReadingPage />} />
          <Route path="readings/:id/finish" element={<FinishReadingPage />} />
          <Route path="books" element={<BooksPage />} />
          <Route path="books/:id" element={<BookDetailPage />} />
          <Route path="authors" element={<AuthorsPage />} />
          <Route path="authors/:id" element={<AuthorDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="analytics/year-in-review" element={<YearInReviewLaunch />} />
          <Route path="analytics/year-in-review/:year" element={<YearInReviewPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
