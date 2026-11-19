import { lazy, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router';
import { AppHeader } from '@/components/AppHeader';
import { MobilePageNavigation } from '@/components/MobilePageNavigation';
import { PageBoundary } from '@/components/PageBoundary';
import { ReadOnlyContext } from '@/data/capabilities';
import { ReadDataContext } from '@/data/readData';
import { WriteDataContext } from '@/data/writeData';
import { ReadingsPage } from '@/features/readings/pages/ReadingsPage';
import { safeReturnTo } from '@/lib/navigation';
import { demoReads, latestDemoYear } from './library';

const BooksPage = lazy(() => import('@/features/books/pages/BooksPage').then(m => ({ default: m.BooksPage })));
const BookDetail = lazy(() => import('@/features/books/pages/BookDetailPage').then(m => ({ default: m.BookDetailPage })));
const AuthorsPage = lazy(() => import('@/features/authors/pages/AuthorsPage').then(m => ({ default: m.AuthorsPage })));
const AuthorDetail = lazy(() => import('@/features/authors/pages/AuthorDetailPage').then(m => ({ default: m.AuthorDetailPage })));
const Analytics = lazy(() => import('@/features/analytics/LocalAnalyticsPage').then(m => ({ default: m.LocalAnalyticsPage })));
const ReviewLaunch = lazy(() => import('@/features/analytics/YearInReviewPage').then(m => ({ default: m.YearInReviewLaunch })));
const Review = lazy(() => import('@/features/analytics/YearInReviewPage').then(m => ({ default: m.YearInReviewPage })));
const BookForm = lazy(() => import('@/features/books/components/BookForm').then(m => ({ default: m.BookForm })));
const ReadingForm = lazy(() => import('@/features/readings/components/ReadingForm').then(m => ({ default: m.ReadingForm })));

async function rejectWrite(): Promise<never> {
  throw new Error('The demo library is read-only.');
}

const demoWrites = {
  createAuthor: rejectWrite,
  updateAuthor: rejectWrite,
  createBook: rejectWrite,
  updateBook: rejectWrite,
  createReading: rejectWrite,
  updateReading: rejectWrite,
};

function FormPreview({ kind }: { kind: 'book' | 'reading' }) {
  const [params] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const cancelTo = safeReturnTo(params.get('returnTo'), kind === 'book' ? '/books' : '/');
  return <>
    <p className="px-6 pt-4 text-sm text-muted-foreground">Try the form with sample data. Entries are discarded when you leave.</p>
    {kind === 'book'
      ? <BookForm preview heading="Try adding a book" isPending={false} error={null} cancelTo={cancelTo} submitLabel="Preview submission" onSubmit={() => setSubmitted(true)} />
      : <ReadingForm preview heading="Try logging a reading" mode="create" isPending={false} cancelTo={cancelTo} onSubmit={() => setSubmitted(true)} />}
    {submitted && <p role="status" className="px-6 pb-6">Preview complete. The demo library is unchanged.</p>}
  </>;
}

function DemoLayout() {
  return <>
    <div className="[&_.app-header]:gap-2 [&_.app-header]:flex-wrap">
      <AppHeader />
    </div>
    <MobilePageNavigation />
    <main><PageBoundary><Outlet /></PageBoundary></main>
  </>;
}

export function DemoApp() {
  return <ReadOnlyContext value={true}>
    <ReadDataContext value={demoReads}>
      <WriteDataContext value={demoWrites}>
        <Routes>
          <Route element={<DemoLayout />}>
            <Route index element={<ReadingsPage preview defaultYear={latestDemoYear} />} />
            <Route path="books" element={<BooksPage preview />} />
            <Route path="books/new" element={<FormPreview key="book" kind="book" />} />
            <Route path="books/:id" element={<BookDetail />} />
            <Route path="authors" element={<AuthorsPage hideDemographics />} />
            <Route path="authors/:id" element={<AuthorDetail />} />
            <Route path="readings/new" element={<FormPreview key="reading" kind="reading" />} />
            <Route path="analytics" element={<Analytics showReadingMix={false} />} />
            <Route path="analytics/year-in-review" element={<ReviewLaunch />} />
            <Route path="analytics/year-in-review/:year" element={<Review />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </WriteDataContext>
    </ReadDataContext>
  </ReadOnlyContext>;
}
