import { useState } from 'react';
import { Link } from 'react-router';
import { Rating } from '@/components/Rating';
import type { AuthorBook } from '@/api/types';
import { BookReadingsPanel } from '../../books/components/BookReadingsPanel';

export function AuthorBookCard({ book }: { book: AuthorBook }) {
    const [expanded, setExpanded] = useState(false);
    const rating = book.lastReading?.rating;

    return (
        <div className="min-w-0 rounded-lg border p-4">
            <Link
                to={`/books/${book.id}`}
                className="block break-words font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
                {book.title}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
                {book.genre.name} · {book.category} · {book.pageCount} pages
            </p>
            {book.lastReading && (
                <p className="mt-2 text-sm text-muted-foreground">
                    {book.lastReading.format} · {book.lastReading.dateUncertain ? 'Date uncertain' : `${book.lastReading.startedOn} – ${book.lastReading.finishedOn ?? '—'}`}
                </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((current) => !current)}
                    className="hover:underline"
                >
                    Readings ({book.readingCount}) {expanded ? '▴' : '▾'}
                </button>
                <Rating value={rating} />
            </div>
            {expanded && (
                <div className="mt-3 border-t pt-3">
                    <BookReadingsPanel bookId={book.id} />
                </div>
            )}
        </div>
    );
}
