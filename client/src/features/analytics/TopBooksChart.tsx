import { useReadingControls } from '@/features/auth/useReadingControls';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useGenres } from '@/features/genres/useGenres';
import { useTags } from '@/features/tags/useTags';
import { formatAuthor } from '@/lib/format';
import { useTopBooks } from './useAnalytics';

export function TopBooksChart() {
    const [tagId, setTagId] = useState('');
    const [genreId, setGenreId] = useState('');
    const { graphicNovels } = useReadingControls();
    const [include, setIncludeGraphicNovels] = useState(false);
    const includeGraphicNovels = !graphicNovels || include;
    const tags = useTags();
    const genres = useGenres();
    const hasFilter = tagId !== '' || genreId !== '';
    const books = useTopBooks({
        tagId: tagId === '' ? undefined : Number(tagId),
        genreId: genreId === '' ? undefined : Number(genreId),
        includeGraphicNovels,
    });

    return (
        <div className="rounded-lg border p-6">
            <div className="mb-4">
                <h2 className="mb-1 text-lg font-medium">Top rated books</h2>
                <p className="text-sm text-muted-foreground">
                    All years · Average ratings across completed, non-abandoned readings, including rereads.
                    Both filters must match when selected. Tags use your current personal assignments.
                </p>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                    Tag
                    <NativeSelect value={tagId} onChange={(event) => setTagId(event.target.value)} disabled={tags.isPending || tags.isError}>
                        <option value="">{tags.isPending ? 'Loading tags…' : 'Any tag'}</option>
                        {tags.data?.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                    </NativeSelect>
                </label>
                <label className="flex items-center gap-2 text-sm">
                    Genre
                    <NativeSelect value={genreId} onChange={(event) => setGenreId(event.target.value)} disabled={genres.isPending || genres.isError}>
                        <option value="">{genres.isPending ? 'Loading genres…' : 'Any genre'}</option>
                        {genres.data?.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}
                    </NativeSelect>
                </label>
                <Button
                    type="button"
                    variant="outline"
                    disabled={!hasFilter}
                    onClick={() => {
                        setTagId('');
                        setGenreId('');
                    }}
                >
                    Clear
                </Button>
            </div>
            {tags.isError && <p role="alert" className="mb-4 text-sm text-destructive">Failed to load tags: {tags.error.message}</p>}
            {genres.isError && <p role="alert" className="mb-4 text-sm text-destructive">Failed to load genres: {genres.error.message}</p>}
            {graphicNovels && <label className="mb-4 flex w-fit items-center gap-2 text-sm">
                <input type="checkbox" checked={includeGraphicNovels} onChange={(event) => setIncludeGraphicNovels(event.target.checked)} className="size-4 accent-primary" />
                Include graphic novels
            </label>}
            {!hasFilter ? <p className="text-sm text-muted-foreground">Select a tag or genre to see your top rated books.</p> :
                books.isPending ? <p role="status">Loading top rated books…</p> :
                books.isError ? <p role="alert" className="text-sm text-destructive">Failed to load top rated books: {books.error.message}</p> :
                books.data.length === 0 ? <p className="text-sm text-muted-foreground">No rated completed books match these filters.</p> : (
                    <ol aria-label="Books by average rating" className="divide-y">
                        {books.data.map((book, index) => (
                            <li key={book.bookId} className="flex items-center gap-4 py-3">
                                <span className="min-w-6 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
                                <div className="min-w-0 flex-1 break-words">
                                    <Link to={`/books/${book.bookId}`} className="font-medium hover:underline">{book.title}</Link>
                                    <p className="text-sm text-muted-foreground">{formatAuthor(book)}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-xs text-muted-foreground">Average rating</p>
                                    <p className="font-semibold tabular-nums" aria-label={`${book.averageRating.toFixed(2)} out of 10`}>{book.averageRating.toFixed(2)}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
        </div>
    );
}
