import { useFormReturn } from '@/hooks/useFormReturn';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { safeReturnTo } from '../../../lib/navigation';
import type { Reading } from '../../../api/types';
import { useBook } from '@/features/books/api/useBook';
import type { TagChoice } from '../../tags/TagPicker';
import { ReadingForm } from '../components/ReadingForm';
import { useFinishReading } from '../api/useFinishReading';
import { useReading } from '../api/useReading';
import type { ReadingFormValues } from '../readingTypes';

export function FinishReadingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();

  const returnTo = safeReturnTo(params.get('returnTo'), '/');
  const reading = useReading(Number(id));

  if (reading.isPending) {
    return <p>Loading…</p>;
  }
  if (reading.isError) {
    return <p>Couldn't load this reading.</p>;
  }

  if (reading.data.dateUncertain) return <Navigate to={`/readings/${id}/edit${params.size ? `?${params}` : ''}`} replace />;

  return <FinishReadingForm reading={reading.data} returnTo={returnTo} />;
}

type FormProps = {
  reading: Reading;
  returnTo: string;
};

function FinishReadingForm({ reading, returnTo }: FormProps) {
  const returnFromForm = useFormReturn();
  const book = useBook(reading.book.id);
  const finish = useFinishReading(reading.id, reading.book.id);

  function handleSubmit(values: ReadingFormValues, tags: TagChoice[]) {
    finish.mutate(
      { values, tags },
      { onSuccess: () => { clearFormDraft(`/readings/${reading.id}/finish`); returnFromForm(returnTo); } },
    );
  }

  if (book.isPending) {
    return <p>Loading…</p>;
  }
  if (book.isError) {
    return <p>Couldn't load this book.</p>;
  }

  return (
    <ReadingForm
      heading="Finish reading"
      mode="finish"
      bookTitle={reading.book.title}
      initialValues={{
        bookId: reading.book.id,
        startedOn: reading.startedOn,
        format: reading.format,
        finishedOn: reading.finishedOn,
        rating: reading.rating,
        review: reading.review,
      }}
      initialTags={book.data.tags}
      onSubmit={handleSubmit}
      isPending={finish.isPending}
        error={finish.error}
      cancelTo={returnTo}
    />
  );
}