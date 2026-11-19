import type { ReadingStats } from '../utils/readingStats';
import { useState } from 'react';
import { Rating } from '@/components/Rating';
import type { BookReading } from '@/api/types';

export function BookReadingCard({ reading, stats }: { reading: BookReading; stats?: ReadingStats }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="min-w-0 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{reading.format}</span>
                <Rating value={reading.rating} />
            </div>
            {!reading.dateUncertain && <p className="mt-2 text-muted-foreground">Started: {reading.startedOn}</p>}
            <p className="text-muted-foreground">
                {reading.dateUncertain ? 'Date uncertain' : reading.finishedOn ? `Finished: ${reading.finishedOn}` : reading.abandoned ? 'Abandoned' : 'In progress'}
            </p>
            {stats?.days != null && <p className="mt-2 text-muted-foreground">
                {stats.days} {stats.days === 1 ? 'day' : 'days'}{!reading.finishedOn ? ' so far' : ''}
                {stats.pagesPerDay != null && ` · ${stats.pagesPerDay.toFixed(1)} pages/day`}
            </p>}
            {reading.review && (
                <>
                    <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded((current) => !current)}
                        className="mt-3 hover:underline"
                    >
                        Review {expanded ? '▴' : '▾'}
                    </button>
                    {expanded && (
                        <p className="mt-3 whitespace-pre-wrap break-words border-t pt-3">{reading.review}</p>
                    )}
                </>
            )}
        </div>
    );
}
