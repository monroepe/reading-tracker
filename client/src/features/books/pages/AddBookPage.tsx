import { clearFormDraft } from '@/hooks/useFormDraftState';
import { useNavigate, useSearchParams } from 'react-router';
import { safeReturnTo, withParam } from '../../../lib/navigation';
import { BookForm } from '../components/BookForm';
import { useCreateBook } from '../api/useCreateBook';

export function AddBookPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const returnTo = safeReturnTo(params.get('returnTo'), '/books');
    const selectCreated = params.get('selectCreated') === 'true';
    const create = useCreateBook();

    return (
        <BookForm
            heading="Add book"
            submitLabel="Save"
            cancelTo={returnTo}
            isPending={create.isPending}
            error={create.error}
            onSubmit={(payload) =>
                create.mutate(payload, {
                    onSuccess: (book) => {
                        clearFormDraft('/books/new');
                        const target = selectCreated
                            ? withParam(returnTo, 'bookId', String(book.id))
                            : returnTo;
                        navigate(target, { replace: true });
                    },
                })
            }
        />
    );
}