import { useWriteData } from '@/data/writeData';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormCancelLink } from '@/components/FormCancelLink';
import { useFormDraftState, clearFormDraft } from '@/hooks/useFormDraftState';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useCompanion } from '@/data/capabilities';
import { useMe } from '@/features/auth/useAuth';
import { ApiError } from '@/api/client';
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
import { useAuthors } from '@/features/authors/api/useAuthors';
import { useGenres } from '../../genres/useGenres';
import { TagPicker, type TagChoice } from '../../tags/TagPicker';
import { formatAuthor } from '../../../lib/format';

type AuthorOption = { id: number; label: string };

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export type BookPayload = {
  title: string;
  authorId: number;
  coAuthors: string | null;
  genre: { id: number } | { name: string };
  tags: TagChoice[];
  category: 'Fiction' | 'Non-fiction';
  pageCount: number;
};

export type BookFormInitial = {
  title: string;
  author: AuthorOption;
  coAuthors: string;
  genreName: string;
  tags: { id: number; name: string }[];
  category: 'Fiction' | 'Non-fiction';
  pageCount: number;
};

type Props = {
  heading: string;
  submitLabel: string;
  preview?: boolean;
  cancelTo?: string;
  initial?: BookFormInitial;
  isPending: boolean;
  error: Error | null;
  onSubmit: (payload: BookPayload) => void;
};

export function BookForm({
  heading,
  submitLabel,
  preview = false,
  cancelTo = '/books',
  initial,
  isPending,
  error,
  onSubmit,
}: Props) {
  const companion = useCompanion();
  const me = useMe(!companion && !preview);
  const canCreateGenre = companion || me.data?.role === 'admin';
  const writes = useWriteData(), cache = useQueryClient();
  const authors = useAuthors();
  const genres = useGenres();
  const location = useLocation();
  const [params] = useSearchParams();

  const [title, setTitle] = useFormDraftState('title', initial?.title ?? params.get('title') ?? '');
  // undefined = untouched, so the authorId URL param can preselect; null = user cleared it
  const [author, setAuthor] = useFormDraftState<AuthorOption | null | undefined>('author', initial?.author);
  const [authorQuery, setAuthorQuery] = useFormDraftState('authorQuery', '');
  const [coAuthors, setCoAuthors] = useFormDraftState('coAuthors', initial?.coAuthors ?? '');
  const [genreText, setGenreText] = useFormDraftState('genreText', initial?.genreName ?? '');
  const createGenre = useMutation({mutationFn:()=>writes.createCatalog!('genres',genreText.trim()),onSuccess:async g=>{
    setGenreText(g.name);await cache.invalidateQueries({queryKey:['genres']});
  }});
  const [selectedTags, setSelectedTags] = useFormDraftState<TagChoice[]>('selectedTags', initial?.tags ?? []);
  const [category, setCategory] = useFormDraftState('category', initial?.category ?? 'Fiction');
  const [pageCount, setPageCount] = useFormDraftState('pageCount', initial ? String(initial.pageCount) : '');

  const authorOptions: AuthorOption[] = (authors.data ?? []).map((a) => ({
    id: a.id,
    label: formatAuthor(a),
  }));
  const [authorTouched, setAuthorTouched] = useState(false);
  const preselectedAuthorId = Number(params.get('authorId'));
  const selectedAuthor =
    !authorTouched && preselectedAuthorId > 0
      ? (authorOptions.find(value => value.id === preselectedAuthorId) ?? null)
      : author !== undefined
      ? author
      : (authorOptions.find((a) => a.id === preselectedAuthorId) ?? null);

  const addAuthorParams = new URLSearchParams({
    returnTo: location.pathname + location.search + location.hash,
    selectCreated: 'true',
  });
  if (authorQuery.trim() !== '') {
    addAuthorParams.set('name', authorQuery.trim());
  }
  const addAuthorHref = `/authors/new?${addAuthorParams.toString()}`;

  const genre = (genres.data ?? []).find((g) => sameText(g.name, genreText));
  const pages = Number(pageCount);
  const canSave =
    title.trim() !== '' &&
    selectedAuthor !== null &&
    !!genre &&
    Number.isInteger(pages) &&
    pages >= 1;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedAuthor || !canSave) {
      return;
    }
    onSubmit({
      title: title.trim(),
      authorId: selectedAuthor.id,
      coAuthors: coAuthors.trim() || null,
      genre: genre ? { id: genre.id } : { name: genreText.trim() },
      tags: selectedTags,
      category,
      pageCount: pages,
    });
  }

  return (
    <section className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{heading}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Label className="flex-col items-start">
          Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="author">Author</Label>
          <Combobox
            items={authorOptions}
            value={selectedAuthor}
            onValueChange={value => { setAuthorTouched(true); setAuthor(value); }}
            itemToStringLabel={(a: AuthorOption) => a.label}
            isItemEqualToValue={(a: AuthorOption, b: AuthorOption) => a.id === b.id}
          >
            <ComboboxInput
              id="author"
              placeholder="Select author"
              onChange={(e) => setAuthorQuery(e.target.value)}
            />
            <ComboboxContent>
              <ComboboxEmpty>
                No match.
                {!preview && <Link className="ml-1 underline" to={addAuthorHref}>
                  Add a new author
                </Link>}
              </ComboboxEmpty>
              <ComboboxList>
                {(a: AuthorOption) => (
                  <ComboboxItem key={a.id} value={a}>
                    {a.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        <Label className="flex-col items-start">
          Co-authors (optional)
          <Input value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)} />
        </Label>
        <div className="flex flex-col gap-2">
          <Label htmlFor="genre">Genre</Label>
          <Combobox
            items={(genres.data ?? []).map((g) => g.name)}
            value={genreText || null}
            onValueChange={(value) => setGenreText(value ?? '')}
          >
            <ComboboxInput
              id="genre"
              placeholder={genres.isPending ? 'Loading genres…' : 'Type or select a genre'}
              disabled={!canCreateGenre && (genres.isPending || genres.isError)}
              onChange={(e) => setGenreText(e.target.value)}
            />
            <ComboboxContent>
              <ComboboxEmpty>
                {genres.isPending ? 'Loading genres…' : genres.isError ? 'Could not load genres.' : canCreateGenre ? 'No matching genre. You can use your own text.' : 'No matching genre. Select an existing genre.'}
              </ComboboxEmpty>
              <ComboboxList>
                {(name: string) => (
                  <ComboboxItem key={name} value={name}>
                    {name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        {genres.isError && <p role="alert" className="text-sm text-destructive">Unable to load genres. Please reload the page to try again.</p>}
        {canCreateGenre && genreText.trim() !== '' && !genre && (
          <p className="text-sm text-muted-foreground">
            <Button type="button" variant="outline" disabled={createGenre.isPending || genres.isPending || genres.isError} onClick={()=>createGenre.mutate()}>Create genre “{genreText.trim()}”</Button>
            {createGenre.isError && <span role="alert">{createGenre.error.message}</span>}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">Tags (optional)</Label>
          <TagPicker allowCreate={!preview} id="tags" value={selectedTags} onChange={setSelectedTags} />
        </div>
        <Label className="flex-col items-start">
          Category
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="Fiction">Fiction</option>
            <option value="Non-fiction">Non-fiction</option>
          </select>
        </Label>
        <Label className="flex-col items-start">
          Pages
          <Input
            type="number"
            min={1}
            step={1}
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
          />
        </Label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error instanceof ApiError && error.status === 409
              ? 'A book with that title and author already exists.'
              : error.message}
          </p>
        )}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isPending || !canSave}>
            {isPending ? 'Saving…' : submitLabel}
          </Button>
          <Button render={<FormCancelLink to={cancelTo} onClick={() => clearFormDraft(location.pathname)} />} nativeButton={false} variant="outline">
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}