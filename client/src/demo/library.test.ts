import { expect, it } from 'vitest';
import books from './books.json';
import readings from './readings.json';
import { createDemoReadings, demoReads, latestDemoYear } from './library';

it('has 125 distinct books and 130 valid readings in the fixture', () => {
  const bookIds = new Set(books.map(book => book.id));
  expect(bookIds.size).toBe(125);
  expect(books.filter(book => book.category === 'Fiction')).toHaveLength(100);
  expect(books.filter(book => book.category === 'Non-fiction')).toHaveLength(25);
  expect(new Set(readings.map(reading => reading.id)).size).toBe(130);
  expect(new Set(readings.map(reading => reading.bookId))).toEqual(bookIds);
  expect(readings.every(reading => reading.startedOn <= reading.finishedOn)).toBe(true);
  expect([...new Set(readings.map(reading => reading.finishedOn.slice(0, 4)))]).toEqual(['2024', '2025']);
});

it('searches and paginates books, filters tags, and exposes rereads and analytics', async () => {
  expect(await demoReads.books.list({ page: 5 })).toMatchObject({ total: 125, page: 5, pageSize: 25 });
  expect((await demoReads.books.list({ search: 'Middlemarch' })).data[0].title).toBe('Middlemarch');
  const tag = (await demoReads.tags.list({ q: 'Book club', page: 1, pageSize: 25 })).data[0];
  const result = await demoReads.books.list({ tagIds: [tag.id] });
  expect(result.total).toBeGreaterThan(25);
  expect(result.data.every(book => book.tags.some(value => value.id === tag.id))).toBe(true);
  expect(await demoReads.books.readings(2)).toHaveLength(2);
  const years = await demoReads.analytics!.byYear({});
  expect(years.map(row => row.year)).toEqual([latestDemoYear - 3, latestDemoYear - 2, latestDemoYear - 1, latestDemoYear]);
  expect(years.reduce((count, row) => count + row.count, 0)).toBe(130);
});

it.each(['2026-01-01', '2026-11-18', '2027-01-01'])('keeps four years of samples at %s', today => {
  const readings = createDemoReadings(today);
  const completed = readings.filter(row => row.finishedOn !== null);
  expect(completed).toHaveLength(130);
  expect(new Set(completed.map(row => row.bookId)).size).toBe(125);
  expect(new Set(completed.map(row => row.finishedOn!.slice(0, 4))).size).toBe(4);
  expect(completed.every(row => row.startedOn <= row.finishedOn! && row.finishedOn! <= today)).toBe(true);
  expect(completed.filter(row => row.format === 'Print')).toHaveLength(78);
  expect(completed.filter(row => row.format === 'Kindle')).toHaveLength(39);
  expect(completed.filter(row => row.format === 'Audiobook')).toHaveLength(13);
  expect(readings.filter(row => row.finishedOn === null)).toEqual([expect.objectContaining({ startedOn: today })]);
});
