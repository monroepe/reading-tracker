import { createHash } from 'node:crypto';
import type { SnapshotRecord } from './transfer-contract.js';

export type Alias = { entityType: string; incomingId: string; localId: string };
export const aliasKey = (type: string, id: string) => `${type}:${id}`;

// A mapped catalog proposal links identities; it never overwrites the target's metadata.
export function remapRecord(record: SnapshotRecord, aliases: Alias[], libraryId: string): SnapshotRecord {
  const result = structuredClone(record);
  const resolve = (type: string, id: string) => aliases.find(a => a.entityType === type && a.incomingId === id)?.localId ?? id;
  if (result.data) {
    if (result.entityType === 'authors') result.data.countryIds = [...new Set(result.data.countryIds.map(id => resolve('countries', id)))].sort();
    if (result.entityType === 'books') { result.data.authorId = resolve('authors', result.data.authorId); result.data.genreId = resolve('genres', result.data.genreId); }
    if (result.entityType === 'readings' || result.entityType === 'bookTags') result.data.bookId = resolve('books', result.data.bookId);
    if (result.entityType === 'bookTags') {
      result.data.tagIds = [...new Set(result.data.tagIds.map(id => resolve('tags', id)))].sort();
      const hex = createHash('md5').update(`${libraryId}:${result.data.bookId}`).digest('hex');
      result.entityId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  }
  return result;
}
