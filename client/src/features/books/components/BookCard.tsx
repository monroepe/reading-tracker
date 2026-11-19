import { FormLink } from '@/components/FormLink';
import { CatalogEdit } from '@/features/auth/CatalogEdit';
import { useState } from 'react';
import { Rating } from '@/components/Rating';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { formatAuthor } from '../../../lib/format';
import type { Book } from '../../../api/types';
import { useBookReadings } from '../api/useBookReadings';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

interface BookCardProps {
    book: Book;
}

export function BookCard({ book }: BookCardProps) {
    const [expanded, setExpanded] = useState(false);
    // The query stays disabled until the card is expanded, then the result is cached.
    const readings = useBookReadings(expanded ? book.id : undefined);

    return (
        <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <Link to={`/books/${book.id}`} className={`${linkClass} block truncate`}>
                        {book.title}
                    </Link>
                    <Link
                        to={`/authors/${book.author.id}`}
                        className="block truncate text-sm text-muted-foreground hover:underline"
                    >
                        {formatAuthor(book.author)}
                    </Link>
                </div>
                <CatalogEdit><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/books/${book.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></CatalogEdit>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                    {book.genre.name} · {book.category}
                </span>
                <div className="flex items-center gap-3">
                    <span>{book.pageCount} pages</span>
                    <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((current) => !current)}
                        className="hover:underline"
                    >
                        Readings {expanded ? '▴' : '▾'}
                    </button>
                </div>
            </div>
            {expanded && (
                <div className="mt-3 border-t pt-3 text-sm">
                    {readings.isPending && <p className="text-muted-foreground">Loading…</p>}
                    {readings.isError && (
                        <p role="alert" className="text-destructive">
                            {readings.error.message}
                        </p>
                    )}
                    {readings.isSuccess && readings.data.length === 0 && (
                        <p className="text-muted-foreground">No readings yet.</p>
                    )}
                    {readings.isSuccess && readings.data.length > 0 && (
                        <ul className="space-y-3">
                            {readings.data.map((reading) => (
                                <li key={reading.id} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">
                                            {reading.dateUncertain ? 'Date uncertain' : reading.finishedOn ??
                                                (reading.abandoned ? 'Abandoned' : 'In progress')}
                                        </span>
                                        <Rating value={reading.rating} />
                                    </div>
                                    {reading.review && (
                                        <p className="whitespace-pre-wrap">{reading.review}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
