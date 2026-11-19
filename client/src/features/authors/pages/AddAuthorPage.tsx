import { clearFormDraft } from '@/hooks/useFormDraftState';
import { useNavigate, useSearchParams } from 'react-router';
import { safeReturnTo, withParam } from '../../../lib/navigation';
import { AuthorForm } from '../components/AuthorForm';
import { useCreateAuthor } from '../api/useCreateAuthor';

export function AddAuthorPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const returnTo = safeReturnTo(params.get('returnTo'), '/authors');
    const selectCreated = params.get('selectCreated') === 'true';
    const create = useCreateAuthor();

    return (
        <AuthorForm
            heading="Add author"
            submitLabel="Save"
            cancelTo={returnTo}
            isPending={create.isPending}
            error={create.error}
            onSubmit={(payload) =>
                create.mutate(payload, {
                    onSuccess: (author) => {
                        clearFormDraft('/authors/new');
                        const target = selectCreated
                            ? withParam(returnTo, 'authorId', String(author.id))
                            : returnTo;
                        navigate(target, { replace: true });
                    },
                })
            }
        />
    );
}