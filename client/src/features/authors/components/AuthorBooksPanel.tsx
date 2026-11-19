import { Link } from 'react-router';
import { Rating } from '@/components/Rating';
import { useAuthorBooks } from '../api/useAuthorBooks';

const linkClass = 'font-medium text-blue-600 hover:underline dark:text-blue-400';

interface AuthorBooksPanelProps {
    authorId: number;
}

export function AuthorBooksPanel({ authorId }: AuthorBooksPanelProps) {
    const books = useAuthorBooks(authorId);

    return (
        <div className="text-sm">
            <h3 className="mb-2 font-medium">Books</h3>
            {books.isPending && <p className="text-muted-foreground">Loading…</p>}
            {books.isError && (
                <p role="alert" className="text-destructive">
                    {books.error.message}
                </p>
            )}
            {books.isSuccess && books.data.length === 0 && (
                <p className="text-muted-foreground">No books yet.</p>
            )}
            {books.isSuccess && books.data.length > 0 && (
                <ul className="space-y-2">
                    {books.data.map((book) => (
                        <li key={book.id} className="flex items-center gap-4">
                            <Link to={`/books/${book.id}`} className={linkClass}>
                                {book.title}
                            </Link>
                            <Rating value={book.lastReading?.rating} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
