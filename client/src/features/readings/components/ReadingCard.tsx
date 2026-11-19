import { WriteOnly } from '@/components/WriteOnly';
import { FormLink } from '@/components/FormLink';
import { useState } from 'react';
import { Rating } from '@/components/Rating';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { formatAuthor } from '../../../lib/format';
import type { Reading } from '../../../api/types';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

interface ReadingCardProps {
    reading: Reading;
}

export function ReadingCard({ reading }: ReadingCardProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <Link to={`/books/${reading.book.id}`} className={`${linkClass} block truncate`}>
                        {reading.book.title}
                    </Link>
                    <Link
                        to={`/authors/${reading.author.id}`}
                        className="block truncate text-sm text-muted-foreground hover:underline"
                    >
                        {formatAuthor(reading.author)}
                    </Link>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                <WriteOnly><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/readings/${reading.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></WriteOnly>
                {!reading.dateUncertain && !reading.abandoned && reading.finishedOn === null && <WriteOnly><Button
                    variant="outline" size="sm" render={<FormLink to={`/readings/${reading.id}/finish`} />} nativeButton={false}
                >Finish</Button></WriteOnly>}
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                    {reading.genre.name} · {reading.format}
                </span>
                <div className="flex items-center gap-3">
                    {reading.review && (
                        <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => setExpanded((current) => !current)}
                            className="hover:underline"
                        >
                            Review {expanded ? '▴' : '▾'}
                        </button>
                    )}
                    <Rating value={reading.rating} />
                </div>
            </div>
            {reading.dateUncertain && <p className="mt-2 text-sm text-muted-foreground">Date uncertain</p>}
            {expanded && reading.review && (
                <div className="mt-3 border-t pt-3 text-sm">
                    <p className="whitespace-pre-wrap">{reading.review}</p>
                </div>
            )}
        </div>
    );
}
