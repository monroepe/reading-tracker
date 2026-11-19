import { Star } from 'lucide-react';

export function Rating({ value }: { value: number | null | undefined }) {
    return (
        <span
            className="inline-flex shrink-0 items-center gap-1 tabular-nums"
            aria-label={value == null ? 'No rating' : `${value} out of 10 stars`}
        >
            {value ?? '—'}
            {value != null && (
                <Star className="size-4 fill-current text-amber-500" aria-hidden="true" />
            )}
        </span>
    );
}
