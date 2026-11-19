import { useFormReturn } from '@/hooks/useFormReturn';
import { useCompanion } from '@/data/capabilities';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { useLocation } from 'react-router';
import { formatAuthor } from '@/lib/format';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { safeReturnTo } from '../../../lib/navigation';
import { AuthorForm } from '../components/AuthorForm';
import { useAuthor } from '../api/useAuthor';
import { useUpdateAuthor } from '../api/useUpdateAuthor';
import { useDeleteAuthor } from '../api/useDeleteAuthor';

export function EditAuthorPage() {
    const returnFromForm = useFormReturn();
    const companion = useCompanion();
    const location = useLocation();
    const { id } = useParams();
    const authorId = Number(id);
    const [params] = useSearchParams();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const returnTo = safeReturnTo(params.get('returnTo'), '/authors');
    const author = useAuthor(authorId);
    const update = useUpdateAuthor(authorId);
    const remove = useDeleteAuthor(authorId);

    if (author.isPending) {
        return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
    }
    if (author.isError) {
        return (
            <p role="alert" className="p-6 text-sm text-destructive">
                {author.error.message}
            </p>
        );
    }

    const a = author.data;
    const fullName = formatAuthor(a);

    return (
        <>
            <AuthorForm
                heading="Edit author"
                submitLabel="Save changes"
                cancelTo={returnTo}
                initial={{
                    firstName: a.firstName,
                    middleName: a.middleName,
                    lastName: a.lastName,
                    countryIds: a.countries?.map(c=>c.id) ?? [],
                    gender: a.gender,
                }}
                isPending={update.isPending}
                error={update.error}
                onSubmit={(payload) =>
                    update.mutate(payload, { onSuccess: () => { clearFormDraft(location.pathname); returnFromForm(returnTo); } })
                }
            />

            {!companion && <><div className="mx-auto max-w-md border-t px-6 pt-4 pb-6">
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                    Delete author
                </Button>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={(open) => !remove.isPending && setConfirmOpen(open)}
                title="Delete this author?"
                description={`This permanently removes ${fullName} from the catalog.`}
                confirmLabel="Delete"
                isPending={remove.isPending}
                error={remove.error?.message ?? null}
                onConfirm={() =>
                    remove.mutate(undefined, { onSuccess: () => { clearFormDraft(location.pathname); returnFromForm(returnTo); } })
                }
            /></>}
        </>
    );
}