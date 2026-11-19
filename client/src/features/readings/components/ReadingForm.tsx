import { FormCancelLink } from '@/components/FormCancelLink';
import { useFormDraftState, clearFormDraft } from '@/hooks/useFormDraftState';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagPicker, type TagChoice } from '../../tags/TagPicker';
import {
  readingFormats,
  type ReadingFormValues,
  type ReadingFormat,
} from '../readingTypes';
import { getToday } from '../utils/readingUtils';
import { useBooks } from '@/features/books/api/useBooks';

type Props = {
  heading: string;
  preview?: boolean;
  mode: 'create' | 'edit' | 'finish';
  initialValues?: ReadingFormValues;
  initialTags?: TagChoice[];
  dateUncertain?: boolean;
  bookTitle?: string;
  onSubmit: (values: ReadingFormValues, tags: TagChoice[]) => void;
  error?: Error | null;
  isPending: boolean;
  cancelTo: string;
};

type BookOption = { id: number; label: string };

export function ReadingForm({
  heading,
  preview = false,
  mode,
  initialValues,
  initialTags,
  dateUncertain = false,
  bookTitle,
  onSubmit,
  isPending,
  error,
  cancelTo,
}: Props) {
  const isEdit = mode === 'edit';
  const isFinish = mode === 'finish';
  const isReadOnlyBook = isEdit || isFinish;
  const books = useBooks();
  const location = useLocation();
  const [params] = useSearchParams();

  // undefined = untouched, so the bookId URL param can preselect; null = user cleared it
  const [book, setBook] = useFormDraftState<BookOption | null | undefined>('book', undefined);
  const [bookQuery, setBookQuery] = useFormDraftState('bookQuery', '');
  const [startedOn, setStartedOn] = useFormDraftState('startedOn', initialValues?.startedOn ?? getToday());
  const [format, setFormat] = useFormDraftState<ReadingFormat>('format', initialValues?.format ?? 'Print');
  const [finishedOn, setFinishedOn] = useFormDraftState('finishedOn', 
    initialValues?.finishedOn || (mode === 'finish' ? getToday() : ''),
  );
  const [rating, setRating] = useFormDraftState('rating', initialValues?.rating?.toString() ?? '');
  const [review, setReview] = useFormDraftState('review', initialValues?.review ?? '');
  const [tags, setTags] = useFormDraftState<TagChoice[]>('tags', initialTags ?? []);

  const bookOptions: BookOption[] = (books.data ?? []).map((b) => ({ id: b.id, label: b.title }));
  const [bookTouched, setBookTouched] = useState(false);
  const preselectedBookId = Number(params.get('bookId'));
  const selectedBook =
    !bookTouched && preselectedBookId > 0
      ? (bookOptions.find(value => value.id === preselectedBookId) ?? null)
      : book !== undefined ? book : (bookOptions.find((b) => b.id === preselectedBookId) ?? null);
  const bookId = isReadOnlyBook ? initialValues?.bookId : selectedBook?.id;

  const addBookParams = new URLSearchParams({
    returnTo: location.pathname + location.search + location.hash,
    selectCreated: 'true',
  });
  if (bookQuery.trim() !== '') {
    addBookParams.set('title', bookQuery.trim());
  }
  const addBookHref = `/books/new?${addBookParams.toString()}`;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (bookId === undefined || (preview && !startedOn)) {
      return;
    }

    onSubmit(
      {
        bookId,
        startedOn,
        format,
        finishedOn: finishedOn || null,
        rating: rating === '' ? null : Number(rating),
        review: review.trim() || null,
      },
      tags,
    );
  }

  return (
    <section className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{heading}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isReadOnlyBook ? (
          <Label className="flex-col items-start">
            Book
            <Input value={bookTitle ?? ''} disabled />
          </Label>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="book">Book</Label>
            <Combobox
              items={bookOptions}
              value={selectedBook}
              onValueChange={value => { setBookTouched(true); setBook(value); }}
              itemToStringLabel={(b: BookOption) => b.label}
              isItemEqualToValue={(a: BookOption, b: BookOption) => a.id === b.id}
            >
              <ComboboxInput
                id="book"
                placeholder="Select book"
                onChange={(e) => setBookQuery(e.target.value)}
              />
              <ComboboxContent>
                <ComboboxEmpty>
                  No match.
                  {!preview && <Link className="ml-1 underline" to={addBookHref}>
                    Add a book
                  </Link>}
                </ComboboxEmpty>
                <ComboboxList>
                  {(b: BookOption) => (
                    <ComboboxItem key={b.id} value={b}>
                      {b.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        )}

        {!isFinish && (
          <>
            {!dateUncertain && <Label className="flex-col items-start">
              Start Date
              <Input
                type="date"
                required={preview}
                value={startedOn}
                onChange={(e) => setStartedOn(e.target.value)}
              />
            </Label>}

            <Label className="flex-col items-start">
              Format
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as ReadingFormat)}
              >
                {readingFormats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Label>
          </>
        )}

        {(isEdit || isFinish) && (
          <>
            {!dateUncertain && <Label className="flex-col items-start">
              Finish Date
              <Input
                type="date"
                value={finishedOn}
                onChange={(e) => setFinishedOn(e.target.value)}
              />
            </Label>}

            <Label className="flex-col items-start">
              Rating
              <Input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
            </Label>

            <Label className="flex-col items-start">
              Review
              <Textarea rows={6} value={review} onChange={(e) => setReview(e.target.value)} />
            </Label>
          </>
        )}

        {(isEdit || isFinish) && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">Tags (optional)</Label>
            <TagPicker allowCreate={!preview} id="tags" value={tags} onChange={setTags} />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending || bookId === undefined || (preview && !startedOn)}>
            {isPending ? 'Saving…' : preview ? 'Preview submission' : 'Save'}
          </Button>
          <Button render={<FormCancelLink to={cancelTo} onClick={() => clearFormDraft(location.pathname)} />} nativeButton={false} variant="outline">
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}