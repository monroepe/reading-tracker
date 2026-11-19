import { FormLink } from '@/components/FormLink';
import { useReturnScroll } from '@/hooks/useReturnScroll';
import { CatalogEdit } from '@/features/auth/CatalogEdit';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/DataTable';
import { formatAuthor } from '../../../lib/format';
import { authorBookColumns } from '../components/authorBookColumns';
import { useAuthor } from '../api/useAuthor';
import { useAuthorBooks } from '../api/useAuthorBooks';
import { BookReadingsPanel } from '../../books/components/BookReadingsPanel';
import { AuthorBookCard } from '../components/AuthorBookCard';

export function AuthorDetailPage() {
    const { id } = useParams();
    const authorId = Number(id);
    const author = useAuthor(authorId);
    const books = useAuthorBooks(authorId);
    useReturnScroll(!author.isPending && (author.isError || !books.isPending));

    if (author.isPending) {
        return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
    }
    if (author.isError) {
        return (
            <p role="alert" className="p-6 text-sm text-destructive">
                {author.error.message}
            </p>
        );
    }

    const a = author.data;

    return (
        <div className="min-w-0 space-y-6 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 break-words">
                    <h1 className="text-2xl font-semibold">{formatAuthor(a)}</h1>
                    <p className="text-sm text-muted-foreground">
                        {[a.country, a.gender].filter(Boolean).join(' · ') || '—'}
                    </p>
                </div>
                <CatalogEdit><Button
                    variant="outline"
                    size="sm"
                    render={<FormLink to={`/authors/${a.id}/edit`} />}
                    nativeButton={false}
                >
                    Edit
                </Button></CatalogEdit>
            </div>

            <section>
                <h2 className="mb-2 text-lg font-medium">Books</h2>
                {books.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
                {books.isError && (
                    <p role="alert" className="text-sm text-destructive">
                        {books.error.message}
                    </p>
                )}
                {books.isSuccess && books.data.length === 0 && (
                    <p className="text-sm text-muted-foreground">No books yet.</p>
                )}
                {books.isSuccess && books.data.length > 0 && (
                    <>
                        <div className="hidden md:block">
                            <DataTable
                                className="min-w-[1100px]"
                                columns={authorBookColumns}
                                data={books.data}
                                renderExpandedRow={(book) => <BookReadingsPanel bookId={book.id} />}
                            />
                        </div>
                        <div className="space-y-3 md:hidden">
                            {books.data.map((book) => <AuthorBookCard key={book.id} book={book} />)}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
