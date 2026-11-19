import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { discardedChanges } from './import-selection.js';
import { previewExchange } from './transfer-contract.js';
const authorId = randomUUID(), bookId = randomUUID(), otherBookId = randomUUID(), tagId = randomUUID();
const sourceDeviceId = randomUUID();
const record = (entityType: string, entityId: string, data: unknown) => ({ entityType, entityId, revision: randomUUID(), data });
const author = record('authors', authorId, { firstName: 'New', middleName: '', lastName: 'Author', countryIds: [], gender: null });
const tag = record('tags', tagId, { name: 'epic', ownedByLibrary: true });
const book = (id: string) => record('books', id, { title: id, authorId, genreId: randomUUID(), coAuthors: null, category: 'Fiction', pageCount: 100 });
const reading = record('readings', randomUUID(), { bookId, startedOn: '2026-11-01', finishedOn: null, dateUncertain: false, abandoned: false, format: 'Print', rating: null, review: null });
const selection = record('bookTags', randomUUID(), { bookId, tagIds: [tagId] });
function file(records = [author, tag, book(bookId), reading, selection]) {
  return previewExchange.parse({ format: 'reading-tracker', version: 2, kind: 'changes', transferId: randomUUID(), sourceDeviceId, destinationDeviceId: randomUUID(), libraryId: randomUUID(), changes: records.map(record => ({ changeId: randomUUID(), originDeviceId: sourceDeviceId, baseline: null, record })) });
}
it('discards the entire book, readings, tags, and exclusively used new dependencies', () => {
  const exchange = file();
  expect(discardedChanges(exchange, [bookId], [])).toEqual(new Set(exchange.changes.map(c => c.changeId)));
});
it('retains dependencies shared with an included book', () => {
  const exchange = file([author, tag, book(bookId), book(otherBookId), selection, record('bookTags', randomUUID(), { bookId: otherBookId, tagIds: [tagId] })]);
  const discarded = discardedChanges(exchange, [bookId], []);
  expect(discarded.has(exchange.changes[0].changeId)).toBe(false);
  expect(discarded.has(exchange.changes[1].changeId)).toBe(false);
  expect(discarded.has(exchange.changes[2].changeId)).toBe(true);
  expect(discarded.has(exchange.changes[3].changeId)).toBe(false);
});
it('skips proposals mapped to the same canonical book and rejects unknown book IDs', () => {
  const exchange = file([book(bookId), book(otherBookId)]);
  expect(discardedChanges(exchange, [bookId], [{ entityType: 'books', incomingId: bookId, localId: otherBookId }]).size).toBe(2);
  expect(() => discardedChanges(exchange, [randomUUID()], [])).toThrow('Skipped books');
});
