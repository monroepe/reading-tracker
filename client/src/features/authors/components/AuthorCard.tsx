import { FormLink } from '@/components/FormLink';
import { CatalogEdit } from '@/features/auth/CatalogEdit';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Rating } from '@/components/Rating';
import { formatAuthor } from '../../../lib/format';
import type { AuthorListItem } from '../../../api/types';
import { useAuthorBooks } from '../api/useAuthorBooks';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

interface AuthorCardProps {
    author: AuthorListItem;
    hideDemographics?: boolean;
}

export function AuthorCard({ author, hideDemographics = false }: AuthorCardProps) {
    const [expanded, setExpanded] = useState(false);
    // The query stays disabled until the card is expanded, then the result is cached.
    const books = useAuthorBooks(expanded ? author.id : undefined);

    return (
        <div className={hideDemographics ? 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5' : 'rounded-lg border p-4'}>
            <div className={hideDemographics ? 'min-w-0 flex-1' : 'flex items-start justify-between gap-2'}>
                <div className="min-w-0">
                    <Link to={`/authors/${author.id}`} className={`${linkClass} block truncate`}>
                        {formatAuthor(author)}
                    </Link>
                </div>
                <CatalogEdit><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/authors/${author.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></CatalogEdit>
            </div>
            <div className={hideDemographics ? 'shrink-0 whitespace-nowrap text-sm text-muted-foreground' : 'mt-3 flex items-center justify-between text-sm'}>
                {!hideDemographics && <span className="text-muted-foreground">{author.country ?? '—'}</span>}
                {author.bookCount > 0 ? (
                    <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((current) => !current)}
                        className="hover:underline"
                    >
                        {author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}{' '}
                        {expanded ? '▴' : '▾'}
                    </button>
                ) : (
                    <span>0 books</span>
                )}
            </div>
            {expanded && (
                <div className={hideDemographics ? 'w-full border-t pt-2 text-sm' : 'mt-3 border-t pt-3 text-sm'}>
                    {books.isPending && <p className="text-muted-foreground">Loading…</p>}
                    {books.isError && (
                        <p role="alert" className="text-destructive">
                            {books.error.message}
                        </p>
                    )}
                    {books.isSuccess && (
                        <ul className="space-y-1">
                            {books.data.map((book) => (
                                <li key={book.id} className={hideDemographics ? 'flex items-center justify-between gap-4' : undefined}>
                                    <Link to={`/books/${book.id}`} className={linkClass}>
                                        {book.title}
                                    </Link>
                                    {hideDemographics && <Rating value={book.lastReading?.rating} />}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
