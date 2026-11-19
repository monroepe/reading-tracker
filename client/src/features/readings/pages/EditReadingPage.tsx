import { useFormReturn } from '@/hooks/useFormReturn';
import { clearFormDraft } from '@/hooks/useFormDraftState';
import { useCompanion } from '@/data/capabilities';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { safeReturnTo } from '../../../lib/navigation';
import type { Reading } from '../../../api/types';
import { useBook } from '@/features/books/api/useBook';
import type { TagChoice } from '../../tags/TagPicker';
import { ReadingForm } from '../components/ReadingForm';
import { useReading } from '../api/useReading';
import { useUpdateReading } from '../api/useUpdateReading';
import { useDeleteReading } from '../api/useDeleteReading';
import type { ReadingFormValues } from '../readingTypes';

export function EditReadingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();

  const returnTo = safeReturnTo(params.get('returnTo'), '/');
  const reading = useReading(Number(id));

  if (reading.isPending) {
    return (
      <section className="mx-auto max-w-md p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (reading.isError) {
    return (
      <section className="mx-auto max-w-md p-6">
        <p role="alert" className="text-sm text-destructive">
          Couldn't load this reading.
        </p>
      </section>
    );
  }

  return <EditReadingForm reading={reading.data} returnTo={returnTo} />;
}

type FormProps = {
  reading: Reading;
  returnTo: string;
};

function EditReadingForm({ reading, returnTo }: FormProps) {
  const companion = useCompanion();
  const returnFromForm = useFormReturn();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const book = useBook(reading.book.id);
  const update = useUpdateReading(reading.id, reading.book.id);
  const remove = useDeleteReading(reading.id);

  function handleSubmit(values: ReadingFormValues, tags: TagChoice[]) {
    update.mutate(
      { values: reading.dateUncertain
          ? { bookId: values.bookId, format: values.format, rating: values.rating, review: values.review }
          : values, tags },
      { onSuccess: () => { clearFormDraft(`/readings/${reading.id}/edit`); returnFromForm(returnTo); } },
    );
  }

  function handleDelete() {
    remove.mutate(undefined, {
      onSuccess: () => { clearFormDraft(`/readings/${reading.id}/edit`); returnFromForm(returnTo); },
    });
  }

  if (book.isPending) {
    return (
      <section className="mx-auto max-w-md p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (book.isError) {
    return (
      <section className="mx-auto max-w-md p-6">
        <p role="alert" className="text-sm text-destructive">
          Couldn't load this book.
        </p>
      </section>
    );
  }

  return (
    <>
      <ReadingForm
        heading="Edit reading"
        mode="edit"
        dateUncertain={reading.dateUncertain}
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
        isPending={update.isPending}
        error={update.error}
        cancelTo={returnTo}
      />

      {!companion && <div className="mx-auto max-w-md px-6 pb-6">
        <div className="border-t pt-4">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete reading
          </Button>
        </div>
      </div>}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !remove.isPending && setConfirmOpen(open)}
        title="Delete this reading?"
        description={`This permanently removes your reading of "${reading.book.title}". The book itself stays in the catalog.`}
        confirmLabel="Delete"
        isPending={remove.isPending}
        error={remove.isError ? "Couldn't delete this reading. Try again." : null}
        onConfirm={handleDelete}
      />
    </>
  );
}