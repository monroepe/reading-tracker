export type ReviewReading = {
    readingId: number;
    bookId: number;
    title: string;
    authorId: number;
    firstName: string;
    middleName: string;
    lastName: string;
    format: string;
    finishedOn: string;
    rating: number | null;
    pageCount: number;
};

type RankingOptions = { includeGraphicNovelsInBooks: boolean; includeGraphicNovelsInAuthors: boolean };

export function rankReviewReadings(rows: ReviewReading[], options: RankingOptions) {
    const latestBooks = new Map<number, ReviewReading>();
    const authorBooks = new Map<number, { authorId: number; firstName: string; middleName: string; lastName: string; books: Set<number> }>();

    for (const row of rows) {
        if (options.includeGraphicNovelsInBooks || row.format !== 'Graphic Novel') {
            const previous = latestBooks.get(row.bookId);
            if (!previous || row.finishedOn > previous.finishedOn ||
                (row.finishedOn === previous.finishedOn && row.readingId > previous.readingId)) {
                latestBooks.set(row.bookId, row);
            }
        }
        if (options.includeGraphicNovelsInAuthors || row.format !== 'Graphic Novel') {
            let author = authorBooks.get(row.authorId);
            if (!author) {
                author = { authorId: row.authorId, firstName: row.firstName, middleName: row.middleName, lastName: row.lastName, books: new Set() };
                authorBooks.set(row.authorId, author);
            }
            author.books.add(row.bookId);
        }
    }

    const topBooks = [...latestBooks.values()]
        .filter((row): row is ReviewReading & { rating: number } => row.rating !== null)
        .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title) || a.bookId - b.bookId)
        .slice(0, 10)
        .map(({ bookId, title, authorId, firstName, middleName, lastName, rating }) =>
            ({ bookId, title, authorId, firstName, middleName, lastName, rating }));
    const topAuthors = [...authorBooks.values()]
        .map(({ books: uniqueBooks, ...author }) => ({ ...author, bookCount: uniqueBooks.size }))
        .sort((a, b) => b.bookCount - a.bookCount || a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName) || a.middleName.localeCompare(b.middleName) || a.authorId - b.authorId)
        .slice(0, 10);

    return { topBooks, topAuthors };
}

