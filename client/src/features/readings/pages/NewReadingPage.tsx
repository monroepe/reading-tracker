import { useFormReturn } from '@/hooks/useFormReturn';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { useSearchParams } from 'react-router';
import { safeReturnTo } from '../../../lib/navigation';
import { useCreateReading } from '../api/useCreateReading';
import { ReadingForm } from '../components/ReadingForm';
import type { ReadingFormValues } from '../readingTypes';

export function NewReadingPage() {
    const returnFromForm = useFormReturn();
  const [params] = useSearchParams();

  const returnTo = safeReturnTo(params.get('returnTo'), '/');
  const create = useCreateReading();

  function handleSubmit(values: ReadingFormValues) {
    create.mutate(values, {
      onSuccess: () => { clearFormDraft('/readings/new'); returnFromForm(returnTo); },
    });
  }

  return (
    <ReadingForm
      heading="Log reading"
      mode="create"
      onSubmit={handleSubmit}
      isPending={create.isPending}
        error={create.error}
      cancelTo={returnTo}
    />
  );
}