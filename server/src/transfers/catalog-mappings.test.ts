import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import type { SnapshotRecord } from './transfer-contract.js';
import { remapRecord } from './catalog-mappings.js';

it('rebases and deduplicates a complete tag selection without mutating its proposal', () => {
  const book = randomUUID(), localBook = randomUUID(), tag = randomUUID(), localTag = randomUUID();
  const record = { entityType: 'bookTags' as const, entityId: randomUUID(), revision: randomUUID(), data: { bookId: book, tagIds: [tag, localTag] } };
  const aliases = [{ entityType: 'books', incomingId: book, localId: localBook }, { entityType: 'tags', incomingId: tag, localId: localTag }];
  const mapped = remapRecord(record, aliases, randomUUID());
  expect(mapped.data).toEqual({ bookId: localBook, tagIds: [localTag] });
  expect(mapped.entityId).not.toBe(record.entityId);
  expect(mapped.revision).toBe(record.revision);
  expect(record.data).toEqual({ bookId: book, tagIds: [tag, localTag] });
});

it('remaps country sets and genre references without modifying the original proposal', () => {
  const country = randomUUID(), canonicalCountry=randomUUID(), genre=randomUUID(), canonicalGenre=randomUUID();
  const author: SnapshotRecord = {entityType:'authors',entityId:randomUUID(),revision:randomUUID(),data:{firstName:'',middleName:'',lastName:'Writer',gender:null,countryIds:[country,canonicalCountry]}};
  const aliases=[{entityType:'countries',incomingId:country,localId:canonicalCountry},{entityType:'genres',incomingId:genre,localId:canonicalGenre}];
  const result=remapRecord(author,aliases,randomUUID());
  expect(result.data && 'countryIds' in result.data && result.data.countryIds).toEqual([canonicalCountry]);
  expect(author.data && 'countryIds' in author.data && author.data.countryIds).toEqual([country,canonicalCountry]);
  const book:SnapshotRecord={entityType:'books',entityId:randomUUID(),revision:randomUUID(),data:{title:'Book',authorId:author.entityId,genreId:genre,coAuthors:null,category:'Fiction',pageCount:100}};
  const mapped=remapRecord(book,aliases,randomUUID());
  expect(mapped.data && 'genreId' in mapped.data && mapped.data.genreId).toBe(canonicalGenre);
});
