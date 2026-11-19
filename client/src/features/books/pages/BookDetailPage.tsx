import { readingStats } from '../utils/readingStats';
import { getToday } from '@/features/readings/utils/readingUtils';
import { FormLink } from '@/components/FormLink';
import { useReturnScroll } from '@/hooks/useReturnScroll';
import { useState } from 'react';
import { useCompanion, useReadOnly } from '@/data/capabilities';
import { useMe } from '@/features/auth/useAuth';
import { BookTagsDialog } from '@/features/tags/BookTagsDialog';
import { CatalogEdit } from '@/features/auth/CatalogEdit';
import { Link, useParams } from 'react-router';
import { Rating } from '@/components/Rating';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/DataTable';
import { formatAuthor } from '../../../lib/format';
import { bookReadingColumns, readingYear } from '../components/bookReadingColumns';
import { useBookReadings } from '../api/useBookReadings';
import { useBook } from '../api/useBook';
import { BookReadingCard } from '../components/BookReadingCard';

export function BookDetailPage() {
    const { id } = useParams();
    const companion = useCompanion();
    const readOnly = useReadOnly();
    const [tagsOpen, setTagsOpen] = useState(false);
    const bookId = Number(id);
    const book = useBook(bookId);
    const readings = useBookReadings(bookId);
    useReturnScroll(!book.isPending && (book.isError || !readings.isPending));

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
    const today = getToday();
    const rows = readings.data?.map(reading => ({ ...reading, ...readingStats(reading, b.pageCount, today) })) ?? [];
    const reviewedReadings = readings.data?.filter((reading) => reading.review) ?? [];

    return (
        <div className="mx-auto min-w-0 max-w-5xl space-y-6 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1 break-words">
                    <h1 className="text-2xl font-semibold">{b.title}</h1>
                    <p className="text-sm">
                        <Link
                            to={`/authors/${b.author.id}`}
                            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                            {formatAuthor(b.author)}
                        </Link>
                        {b.coAuthors && <span className="text-muted-foreground">, {b.coAuthors}</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {b.genre.name} · {b.category} · {b.pageCount} pages
                    </p>
                    {b.tags.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            Tags:{' '}
                            {b.tags.map((tag, index) => (
                                <span key={tag.id}>
                                    {index > 0 && ', '}
                                    <Link
                                        to={`/books?tagId=${tag.id}`}
                                        className="text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                        {tag.name}
                                    </Link>
                                </span>
                            ))}
                        </p>
                    )}
                </div>
                <CatalogEdit><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/books/${b.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></CatalogEdit>
            </div>

            {!readOnly && (companion ? <Button variant="outline" onClick={() => setTagsOpen(true)}>Edit tags</Button> : <DesktopTagAction onClick={() => setTagsOpen(true)} />)}
            {tagsOpen && <BookTagsDialog bookId={bookId} initialTags={b.tags} onClose={() => setTagsOpen(false)} />}

            <section>
                <h2 className="mb-2 text-lg font-medium">Readings</h2>
                {readings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
                {readings.isError && (
                    <p role="alert" className="text-sm text-destructive">
                        {readings.error.message}
                    </p>
                )}
                {readings.isSuccess && readings.data.length === 0 && (
                    <p className="text-sm text-muted-foreground">No readings yet.</p>
                )}
                {readings.isSuccess && readings.data.length > 0 && (
                    <>
                        <div className="hidden md:block">
                            <DataTable columns={bookReadingColumns} data={rows} />
                        </div>
                        <div className="space-y-3 md:hidden">
                            {rows.map((reading) => <BookReadingCard key={reading.id} reading={reading} stats={reading} />)}
                        </div>
                    </>
                )}
            </section>

            {reviewedReadings.length > 0 && (
                <section className="hidden md:block">
                    <h2 className="mb-2 text-lg font-medium">Reviews</h2>
                    <ul className="space-y-4">
                        {reviewedReadings.map((reading) => (
                            <li key={reading.id}>
                                <p className="flex items-center gap-2 text-sm font-medium">
                                    {readingYear(reading)} · {reading.format}
                                    {reading.rating !== null && <Rating value={reading.rating} />}
                                </p>
                                <p className="whitespace-pre-line break-words text-sm text-muted-foreground">
                                    {reading.review}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function DesktopTagAction({ onClick }: { onClick: () => void }) {
  const me = useMe();
  return me.data?.role === 'user' ? <Button variant="outline" onClick={onClick}>Add Tags</Button> : null;
}
