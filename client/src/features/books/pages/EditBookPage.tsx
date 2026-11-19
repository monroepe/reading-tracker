import { useFormReturn } from '@/hooks/useFormReturn';
import { useCompanion } from '@/data/capabilities';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { useLocation } from 'react-router';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatAuthor } from '../../../lib/format';
import { safeReturnTo } from '../../../lib/navigation';
import { BookForm } from '../components/BookForm';
import { useBook } from '../api/useBook';
import { useUpdateBook } from '../api/useUpdateBook';
import { useDeleteBook } from '../api/useDeleteBook';

export function EditBookPage() {
    const returnFromForm = useFormReturn();
    const companion = useCompanion();
    const location = useLocation();
    const { id } = useParams();
    const bookId = Number(id);
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const returnTo = safeReturnTo(params.get('returnTo'), '/books');
    const book = useBook(bookId);
    const update = useUpdateBook(bookId);
    const remove = useDeleteBook(bookId);

    if (book.isPending) {
        return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
    }
    if (book.isError) {
        return (
            <p role="alert" className="p-6 text-sm text-destructive">
                {book.error.message}
            </p>
        );
    }

    const b = book.data;
    return (
        <>
            <BookForm
                heading="Edit book"
                submitLabel="Save changes"
                cancelTo={returnTo}
                initial={{
                    title: b.title,
                    author: { id: b.author.id, label: formatAuthor(b.author) },
                    coAuthors: b.coAuthors ?? '',
                    genreName: b.genre.name,
                    tags: b.tags,
                    category: b.category,
                    pageCount: b.pageCount,
                }}
                isPending={update.isPending}
                error={update.error}
                onSubmit={(payload) =>
                    update.mutate(payload, { onSuccess: () => { clearFormDraft(location.pathname); returnFromForm(returnTo); } })
                }
            />

            {!companion && <><div className="mx-auto max-w-md border-t px-6 pt-4 pb-6">
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                    Delete book
                </Button>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={(open) => !remove.isPending && setConfirmOpen(open)}
                title="Delete this book?"
                description={`This permanently removes "${b.title}" from the catalog.`}
                confirmLabel="Delete"
                isPending={remove.isPending}
                error={remove.error?.message ?? null}
                onConfirm={() =>
                    remove.mutate(undefined, { onSuccess: () => navigate('/books', { replace: true }) })
                }
            /></>}
        </>
    );
}