import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db/index.js';
import { HttpError } from '../middleware/errors.js';
import { snapshotExchange, type SnapshotExchange } from './transfer-contract.js';

export type TrackedState = {
  entity_type: string; entity_id: string; revision: string;
  state: { version?: number; fields?: Record<string, unknown>; bookId?: string; tagIds?: string[] } | null;
};

// Explicit projection keeps internal columns and other owners' identities off the wire.
export function project(row: TrackedState, libraryId: string) {
  const fields = row.state?.fields ?? {};
  let data: unknown = null;
  if (row.state) switch (row.entity_type) {
    case 'authors': data = { firstName: fields.first_name, middleName: fields.middle_name,
      lastName: fields.last_name, ...(row.state.version === 2 ? { countryIds: fields.countryIds } : { country: fields.country }), gender: fields.gender }; break;
    case 'countries':
    case 'genres': data = { name: fields.name }; break;
    case 'tags': data = { name: fields.name, ownedByLibrary: fields.creatorLibraryId === libraryId }; break;
    case 'books': data = { title: fields.title, authorId: fields.authorId, genreId: fields.genreId,
      coAuthors: fields.co_authors, category: fields.category, pageCount: fields.page_count }; break;
    case 'readings': data = { bookId: fields.bookId, startedOn: fields.started_on, finishedOn: fields.finished_on,
      dateUncertain: fields.date_uncertain, abandoned: fields.abandoned, format: fields.format,
      rating: fields.rating === null ? null : Number(fields.rating), review: fields.review }; break;
    case 'bookTags': data = { bookId: row.state.bookId, tagIds: row.state.tagIds }; break;
  }
  return { entityType: row.entity_type, entityId: row.entity_id, revision: row.revision, data };
}

export async function createSnapshotExport(
  userId: number, destinationDeviceId: string | null, database: Pick<Pool, 'connect'> = pool,
): Promise<SnapshotExchange> {
  const client = await database.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const exchange = await buildSnapshot(client, userId, destinationDeviceId);
    const serialized = JSON.stringify(exchange);
    if (Buffer.byteLength(serialized, 'utf8') > 10 * 1024 * 1024) {
      throw new HttpError(413, 'Snapshot exceeds the 10 MiB transfer limit');
    }
    await client.query(`INSERT INTO transfer_exports
      (transfer_id, user_id, destination_device_id, payload_sha256, manifest)
      VALUES ($1, $2, $3, $4, $5::json)`, [
      exchange.transferId, userId, destinationDeviceId,
      createHash('sha256').update(serialized).digest('hex'),
      JSON.stringify(exchange.records.map(({ entityType, entityId, revision }) => ({ entityType, entityId, revision }))),
    ]);
    await client.query('COMMIT');
    return exchange;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function buildSnapshot(client: PoolClient, userId: number, destinationDeviceId: string | null) {
  const owner = (await client.query('SELECT library_id FROM users WHERE id = $1', [userId])).rows[0];
  if (!owner) throw new HttpError(401, 'Account no longer exists');
  const device = (await client.query('SELECT device_id FROM transfer_device')).rows[0];
  if (!device) throw new HttpError(503, 'Transfer device identity is not initialized');
  if (destinationDeviceId === device.device_id) throw new HttpError(400, 'Destination must be another device');
  const states = await client.query<TrackedState>(`SELECT entity_type, entity_id, revision, state
    FROM transfer_states WHERE
      (entity_type IN ('countries','authors','genres','tags','books') AND library_id IS NULL)
      OR (entity_type IN ('readings','bookTags') AND library_id = $1)
    ORDER BY entity_type, entity_id`, [owner.library_id]);
  return snapshotExchange.parse({
    format: 'reading-tracker', version: 2, kind: 'snapshot', createdAt: new Date().toISOString(), transferId: randomUUID(),
    sourceDeviceId: device.device_id, destinationDeviceId, libraryId: owner.library_id,
    records: states.rows.map(row => project(row, owner.library_id)),
  });
}
