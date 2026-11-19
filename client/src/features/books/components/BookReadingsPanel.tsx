import { useBookReadings } from "../api/useBookReadings";
import { Rating } from '@/components/Rating';


interface BookReadingsPanelProps {
    bookId: number;
}

export function BookReadingsPanel({ bookId }: BookReadingsPanelProps) {
    const readings = useBookReadings(bookId);

    return (
        <div className="text-sm">
            <h3 className="mb-2 font-medium">Reading Log</h3>
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
                            <div className="flex items-center gap-4">
                                <span className="text-muted-foreground">
                                    {reading.dateUncertain ? 'Date uncertain' : reading.finishedOn ??
                                        (reading.abandoned ? 'Abandoned' : 'In progress')}
                                </span>
                                <Rating value={reading.rating} />
                            </div>
                            {reading.review && (
                                <p className="whitespace-pre-wrap break-words">{reading.review}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
