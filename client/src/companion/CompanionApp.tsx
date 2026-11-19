import { ReadingControlsContext } from '@/features/auth/useReadingControls';
import { PageBoundary } from '@/components/PageBoundary';
import { lazy } from 'react';
import { MenuIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MobilePageNavigation } from '@/components/MobilePageNavigation';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { App as NativeApp } from '@capacitor/app';
import { AppHeader } from '@/components/AppHeader';
import { WriteDataContext } from '@/data/writeData';

import { CompanionContext, ReadOnlyContext } from '@/data/capabilities';
import { ReadDataContext, type ReadData } from '@/data/readData';
import { ReadingsPage } from '@/features/readings/pages/ReadingsPage';

import { openCompanionStorage, type CompanionStorage } from './storage/native';
const CatalogPage = lazy(() => import('@/features/admin/CatalogPage').then(m => ({ default: m.CatalogPage })));
const Settings = lazy(() => import('./Settings'));
const EditAuthorPage = lazy(() => import('@/features/authors/pages/EditAuthorPage').then(module => ({ default: module.EditAuthorPage })));
const EditBookPage = lazy(() => import('@/features/books/pages/EditBookPage').then(module => ({ default: module.EditBookPage })));
const AddAuthorPage = lazy(() => import('@/features/authors/pages/AddAuthorPage').then(module => ({ default: module.AddAuthorPage })));
const AddBookPage = lazy(() => import('@/features/books/pages/AddBookPage').then(module => ({ default: module.AddBookPage })));
const NewReadingPage = lazy(() => import('@/features/readings/pages/NewReadingPage').then(module => ({ default: module.NewReadingPage })));
const FinishReadingPage = lazy(() => import('@/features/readings/pages/FinishReadingPage').then(module => ({ default: module.FinishReadingPage })));
const EditReadingPage = lazy(() => import('@/features/readings/pages/EditReadingPage').then(module => ({ default: module.EditReadingPage })));
const BooksPage = lazy(() => import('@/features/books/pages/BooksPage').then(module => ({ default: module.BooksPage })));
const BookDetailPage = lazy(() => import('@/features/books/pages/BookDetailPage').then(module => ({ default: module.BookDetailPage })));
const AuthorsPage = lazy(() => import('@/features/authors/pages/AuthorsPage').then(module => ({ default: module.AuthorsPage })));
const AuthorDetailPage = lazy(() => import('@/features/authors/pages/AuthorDetailPage').then(module => ({ default: module.AuthorDetailPage })));

const AnalyticsPage = lazy(() => import('./AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const YearInReviewLaunch = lazy(() => import('@/features/analytics/YearInReviewPage').then(m => ({ default: m.YearInReviewLaunch })));
const YearInReviewPage = lazy(() => import('@/features/analytics/YearInReviewPage').then(m => ({ default: m.YearInReviewPage })));
const AdminPage = lazy(() => import('@/features/admin/AdminPage').then(m => ({ default: m.AdminPage })));
function NativeNavigation() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const location = useLocation();
    useEffect(() => {
        const listener = NativeApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack)
                navigate(-1);
            else
                void NativeApp.minimizeApp();
        });
        const resumed = NativeApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                void queryClient.invalidateQueries({ queryKey: ['readings'] });
                void queryClient.invalidateQueries({ queryKey: ['books'] });
            }
        });
        return () => { void listener.then(handle => handle.remove()); void resumed.then(handle => handle.remove()); };
    }, [navigate, queryClient]);
    useEffect(() => { document.title = 'Reading Tracker'; }, [location.pathname]);
    return null;
}
function CompanionLayout() {
    return <><AppHeader analytics={true} actions={<DropdownMenu>
      <DropdownMenuTrigger aria-label="Open menu"><MenuIcon /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem render={<Link to="/admin" />}>Admin</DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/settings" />}>Transfers &amp; settings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>}/><MobilePageNavigation /><main><PageBoundary><Outlet /></PageBoundary></main></>;
}
export function CompanionApp() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [readingControls, setReadingControls] = useState(() => ({
        pre2022: localStorage.getItem('reading-tracker.show-pre-2022') !== 'false',
        graphicNovels: localStorage.getItem('reading-tracker.show-graphic-novels') !== 'false',
    }));
    function setReadingControl(key: keyof typeof readingControls, checked: boolean) {
        const storageKey = key === 'pre2022' ? 'show-pre-2022' : 'show-graphic-novels';
        localStorage.setItem(`reading-tracker.${storageKey}`, String(checked));
        setReadingControls(previous => ({ ...previous, [key]: checked }));
    }
    const [notice, setNotice] = useState('');
    const [storage, setStorage] = useState<CompanionStorage>();
    const [info, setInfo] = useState<Record<string, string>>();
    const [reads, setReads] = useState<ReadData>();
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        void openCompanionStorage().then(async (storage) => {
            const info = await storage.info();
            const reads = info.transferId ? await storage.reads() : undefined;
            if (active) {
                setStorage(storage);
                setInfo(info);
                setReads(reads);
            }
        }).catch((error: unknown) => { if (active)
            setError(error instanceof Error && error.message.startsWith('This update needs a fresh laptop snapshot.') ? error.message : 'Could not open the Android library. Your data has been preserved. Close and reopen the app to retry.'); });
        return () => { active = false; };
    }, []);
    if (error)
        return <p role="alert" className="p-6">{error}</p>;
    if (!storage || !info)
        return <p role="status" className="p-6">Opening library…</p>;
    async function refresh(summary: string) {
        // Publish the provider before exposing routes so a completed bootstrap cannot
        // briefly render a page against the desktop HTTP fallback.
        queryClient.clear();
        await storage!.reload();
        const nextReads = await storage!.reads();
        const nextInfo = await storage!.info();
        setReads(nextReads);
        setInfo(nextInfo);
        setNotice(summary);
        navigate('/settings', { replace: true });
    }
    const editing = (page: React.ReactNode) => info.pendingOutbound ? <Navigate to="/settings" replace/> : page;
    const settings = <Settings storage={storage} info={info} onImported={refresh} notice={notice} setReadingControl={setReadingControl}/>;
    return <CompanionContext value={true}><ReadingControlsContext value={readingControls}><ReadOnlyContext value={!!info.pendingOutbound}><NativeNavigation />
    {reads ? <WriteDataContext value={storage.writes}><ReadDataContext value={reads}><Routes><Route element={<CompanionLayout />}>
      <Route path="authors/:id/edit" element={editing(<EditAuthorPage />)}/>
      <Route path="books/:id/edit" element={editing(<EditBookPage />)}/>
      <Route path="authors/new" element={editing(<AddAuthorPage />)}/>
      <Route path="books/new" element={editing(<AddBookPage />)}/>
      <Route path="readings/new" element={editing(<NewReadingPage />)}/>
      <Route path="readings/:id/finish" element={editing(<FinishReadingPage />)}/>
      <Route path="readings/:id/edit" element={editing(<EditReadingPage />)}/>
      <Route path="analytics" element={<AnalyticsPage />}/><Route path="analytics/year-in-review" element={<YearInReviewLaunch />}/><Route path="analytics/year-in-review/:year" element={<YearInReviewPage />}/><Route index element={<ReadingsPage />}/>
      <Route path="books" element={<BooksPage />}/><Route path="books/:id" element={<BookDetailPage />}/>
      <Route path="authors" element={<AuthorsPage />}/><Route path="authors/:id" element={<AuthorDetailPage />}/>
      <Route path="admin" element={<AdminPage />}/><Route path="admin/countries" element={<CatalogPage kind="countries" />}/><Route path="admin/genres" element={<CatalogPage kind="genres" />}/><Route path="settings" element={settings}/><Route path="*" element={<Navigate to="/" replace/>}/>
    </Route></Routes></ReadDataContext></WriteDataContext> : <PageBoundary>{settings}</PageBoundary>}
  </ReadOnlyContext></ReadingControlsContext></CompanionContext>;
}
