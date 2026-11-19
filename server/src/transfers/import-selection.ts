import { HttpError } from '../middleware/errors.js';
import type { PreviewExchange } from './transfer-contract.js';
import type { Alias } from './catalog-mappings.js';

// Skip a whole book, including every proposal mapped to that canonical book.
// New shared dependencies are discarded only when used exclusively by skipped books.
export function discardedChanges(exchange: PreviewExchange, skippedBookIds: string[], aliases: Alias[]) {
  const canonicalBook = (id: string) => aliases.find(a => a.entityType === 'books' && a.incomingId === id)?.localId ?? id;
  const bookOf = (change: PreviewExchange['changes'][number]) => change.record.entityType === 'books'
    ? change.record.entityId : (change.record.entityType === 'readings' || change.record.entityType === 'bookTags')
      ? change.record.data?.bookId as string | undefined : undefined;
  const known = new Set(exchange.changes.map(bookOf).filter(Boolean));
  if (skippedBookIds.some(id => !known.has(id))) throw new HttpError(400, 'Skipped books must identify books in this file');
  const skipped = new Set(skippedBookIds.map(canonicalBook));
  const discarded = new Set(exchange.changes.filter(change => {
    const id = bookOf(change);
    return id && skipped.has(canonicalBook(id));
  }).map(change => change.changeId));
  for (const change of exchange.changes) {
    const record = change.record;
    if (change.baseline || !record.data || !['authors', 'tags'].includes(record.entityType)) continue;
    const dependents = exchange.changes.filter(other => record.entityType === 'authors'
      ? other.record.entityType === 'books' && other.record.data?.authorId === record.entityId
      : other.record.entityType === 'bookTags' && other.record.data?.tagIds.includes(record.entityId));
    if (dependents.length && dependents.every(other => discarded.has(other.changeId))) discarded.add(change.changeId);
  }
  return discarded;
}
