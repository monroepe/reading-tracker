import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { snapshotExchange, type SnapshotExchange } from './transfer-contract.js';

function fixture(): SnapshotExchange {
  const bookId = randomUUID(), authorId = randomUUID(), genreId = randomUUID();
  return {
    format: 'reading-tracker', version: 2, kind: 'snapshot', transferId: randomUUID(),
    sourceDeviceId: randomUUID(), destinationDeviceId: null, libraryId: randomUUID(),
    records: [
      { entityType: 'authors', entityId: authorId, revision: randomUUID(), data: {
        firstName: '', middleName: '', lastName: 'Author', countryIds: [], gender: null,
      } },
      { entityType: 'genres', entityId: genreId, revision: randomUUID(), data: { name: 'Fiction' } },
      { entityType: 'books', entityId: bookId, revision: randomUUID(), data: {
        title: 'Book', authorId, genreId, coAuthors: null, category: 'Fiction', pageCount: 100,
      } },
      { entityType: 'readings', entityId: randomUUID(), revision: randomUUID(), data: {
        bookId, startedOn: '2026-01-01', finishedOn: '2026-01-02', dateUncertain: true,
        abandoned: false, format: 'Print', rating: 8.5, review: null,
      } },
    ],
  };
}

it('round trips a snapshot including legacy uncertain dates', () => {
  const exchange = fixture();
  expect(snapshotExchange.parse(JSON.parse(JSON.stringify(exchange)))).toEqual(exchange);
});

it('rejects missing or deleted references', () => {
  const exchange = fixture();
  exchange.records[0].data = null;
  expect(snapshotExchange.safeParse(exchange).success).toBe(false);
  exchange.records.shift();
  expect(snapshotExchange.safeParse(exchange).success).toBe(false);
});

it('rejects duplicate identities and unknown fields', () => {
  const exchange = fixture();
  exchange.records.push(exchange.records[0]);
  expect(snapshotExchange.safeParse(exchange).success).toBe(false);
  expect(snapshotExchange.safeParse({ ...fixture(), passwordHash: 'secret' }).success).toBe(false);
});

it.each([
  { startedOn: '2026-02-30' }, { finishedOn: '2025-01-01' },
  { rating: 8.2 }, { abandoned: true }, { format: 'Paperback' },
])('rejects invalid reading fields: %j', fields => {
  const exchange = fixture();
  const reading = exchange.records[3];
  reading.data = { ...reading.data!, ...fields } as typeof reading.data;
  expect(snapshotExchange.safeParse(exchange).success).toBe(false);
});
