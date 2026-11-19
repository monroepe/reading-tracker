import { getToday } from '@/features/readings/utils/readingUtils';
import type { Author, BookDetail, Category, Format } from '@/api/types';
import { createLibraryReadData } from '@/data/libraryReadData';
import bookFixture from './books.json';
import readingFixture from './readings.json';

const catalog = (names: string[]) => [...new Set(names)].map((name, index) => ({ id: index + 1, name }));
const genres = catalog(bookFixture.map(book => book.genre));
const tags = catalog(bookFixture.flatMap(book => book.tags));
const surnameStarts: Record<string, number> = {
  'Ursula K. Le Guin': 2,
  'Daphne du Maurier': 1,
  'Gabriel García Márquez': 1,
  'Giuseppe Tomasi di Lampedusa': 1,
};
const authors = new Map<string, Author>();
const books: BookDetail[] = bookFixture.map(book => {
  let author = authors.get(book.author);
  if (!author) {
    const surnameStart = surnameStarts[book.author] ?? -1;
    const parts = book.author.split(' ');
    const given = parts.slice(0, surnameStart);
    author = {
      id: authors.size + 1,
      firstName: given[0],
      middleName: given.slice(1).join(' '),
      lastName: parts.slice(surnameStart).join(' '),
      country: null,
      gender: null,
    };
    authors.set(book.author, author);
  }
  return {
    id: book.id,
    title: book.title,
    author,
    category: book.category as Category,
    genre: genres.find(genre => genre.name === book.genre)!,
    tags: tags.filter(tag => book.tags.includes(tag.name)),
    coAuthors: book.coAuthors ?? null,
    pageCount: book.pageCount,
  };
});
const dayMs = 86_400_000;

export function createDemoReadings(today: string) {
  const year = Number(today.slice(0, 4));
  const elapsedDays = (Date.parse(today) - Date.UTC(year, 0, 1)) / dayMs;
  const currentCount = Math.min(26, Math.floor(elapsedDays / 14) + 1);
  const counts = [31, 39, readingFixture.length - 70 - currentCount, currentCount];
  // Distribute 78 Print, 39 Kindle, and 13 Audiobook readings unevenly across years.
  const formats: Format[] = [
    ...Array<Format>(78).fill('Print'),
    ...Array<Format>(39).fill('Kindle'),
    ...Array<Format>(13).fill('Audiobook'),
  ];
  const defaults = { abandoned: false, dateUncertain: false, review: null };
  const dateAt = (start: number, days: number) => new Date(start + days * dayMs).toISOString().slice(0, 10);
  let index = 0;
  const completed = counts.flatMap((count, group) => {
    const sampleYear = year - 3 + group;
    const start = Date.UTC(sampleYear, 0, 1);
    const lastDay = group === 3 ? elapsedDays : (Date.UTC(sampleYear + 1, 0, 1) - start) / dayMs - 1;
    return Array.from({ length: count }, (_, position) => {
      const reading = readingFixture[index];
      const format = formats[(index * 47) % formats.length];
      index++;
      const finish = Math.floor(lastDay * (position + 1) / count);
      return {
        ...reading, ...defaults, format,
        startedOn: dateAt(start, Math.max(0, finish - 4 - reading.id % 12)),
        finishedOn: dateAt(start, finish),
      };
    });
  });
  return [...completed, {
    ...defaults, id: 131, bookId: 1, startedOn: today,
    finishedOn: null, rating: null, format: 'Kindle' as const,
  }];
}

const today = getToday();
export const latestDemoYear = Number(today.slice(0, 4));
export const demoReads = createLibraryReadData({
  authors: [...authors.values()], countries: [], genres, tags, books,
  rawReadings: createDemoReadings(today),
});
