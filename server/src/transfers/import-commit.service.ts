import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db/index.js';
import { HttpError } from '../middleware/errors.js';
import { buildPreview } from './import-preview.service.js';
import { resolveImportChoices, validateSelectedReferences } from './import-decisions.js';
import { importCommitRequest, snapshotRecord, type SnapshotRecord, type PreviewExchange } from './transfer-contract.js';
import { project, type TrackedState } from './transfers.service.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
type Outcome = { changeId: string; action: 'applied' | 'local' | 'skipped' | 'discarded'; record: SnapshotRecord | null };
type Result = { transferId: string; outcomes: Outcome[]; confirmedExchange?: PreviewExchange };

export async function commitImport(userId: number, input: unknown, database: Pick<Pool, 'connect'> = pool): Promise<Result> {
  const request = importCommitRequest.parse(input);
  const { exchange } = request;
  // Choice order is irrelevant; the file and selected outcomes must be identical
  // on retry. The old digest is intentionally retained in that identity.
  const requestHash = hash({ ...request, choices: [...request.choices].sort((a, b) => a.changeId.localeCompare(b.changeId)) });
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    // Imports are rare. A coarse lock also excludes ordinary HTTP writes and
    // deferred tag triggers while we replan and save the entire batch.
    await client.query(`LOCK TABLE users, countries, author_countries, authors, genres, tags, books, readings, book_tags,
      transfer_device, transfer_states, transfer_changes, transfer_imports, transfer_import_changes, transfer_aliases
      IN SHARE ROW EXCLUSIVE MODE`);
    const receipt = (await client.query('SELECT * FROM transfer_imports WHERE transfer_id = $1', [exchange.transferId])).rows[0];
    if (receipt) {
      if (receipt.user_id !== userId || receipt.request_sha256 !== requestHash) {
        throw new HttpError(409, 'Transfer identity was already used for a different import');
      }
      await client.query('COMMIT');
      return receipt.result;
    }
    const preview = await buildPreview(client, userId, exchange, request.matches, request.skippedBookIds);
    if (preview.previewDigest !== request.previewDigest) throw new HttpError(409, 'Preview is stale; preview this file again');
    // Change identities may never be reused with different content, including
    // across envelopes. Exact repeats in a new envelope reuse their saved outcome.
    const repeated = new Map<string, Outcome>();
    for (const change of exchange.changes) {
      const prior = (await client.query('SELECT * FROM transfer_import_changes WHERE change_id = $1', [change.changeId])).rows[0];
      if (prior) {
        if (prior.user_id !== userId || prior.origin_device_id !== change.originDeviceId || prior.proposal_sha256 !== hash(change)) {
          throw new HttpError(409, 'Change identity was already used with different content');
        }
        repeated.set(change.changeId, prior.outcome);
      } else if ((await client.query('SELECT 1 FROM transfer_changes WHERE change_id = $1', [change.changeId])).rowCount) {
        throw new HttpError(409, 'Change identity collides with existing history');
      }
    }
    const decisions = resolveImportChoices(preview.items.filter(item => !repeated.has(item.changeId)), request.choices);
    validateSelectedReferences(decisions);
    if (preview.referenceIssues.some(issue => !repeated.has(issue.changeId))) {
      throw new HttpError(409, 'Resolve missing references before committing');
    }
    const discarded = new Set(preview.discardedChangeIds);
    for (const alias of preview.aliases.filter(alias => !exchange.changes.some(change => discarded.has(change.changeId) && change.record.entityType === alias.entityType && change.record.entityId === alias.incomingId))) {
      await client.query(`INSERT INTO transfer_aliases(user_id,source_device_id,entity_type,incoming_id,local_id)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [userId, exchange.sourceDeviceId, alias.entityType, alias.incomingId, alias.localId]);
    }
    const outcomes = new Map<string, Outcome>(repeated);
    const priority = ['countries', 'genres', 'tags', 'authors', 'books', 'readings', 'bookTags'];
    for (const { item, apply, resolution } of [...decisions].sort((a, b) =>
      priority.indexOf(a.item.incoming.entityType) - priority.indexOf(b.item.incoming.entityType))) {
      const prior = repeated.get(item.changeId);
      if (prior) { outcomes.set(item.changeId, prior); continue; }
      let record = item.local;
      if (apply) {
        await writeRecord(client, userId, item.incoming);
        // Deferred tag tracking must be complete before adopting a revision.
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
        const row = (await client.query<TrackedState>(`SELECT entity_type, entity_id, revision, state FROM transfer_states
          WHERE entity_type = $1 AND entity_id = $2`, [item.incoming.entityType, item.incoming.entityId])).rows[0];
        if (!row) throw new Error('Import did not produce tracked state');
        record = snapshotRecord.parse(project(row, exchange.libraryId));
        // Whole tag selections use sorted UUIDs in tracking, regardless of wire order.
        const expected = structuredClone(item.incoming);
        if (expected.entityType === 'authors' && expected.data) expected.data.countryIds.sort();
        if (expected.entityType === 'bookTags' && expected.data) expected.data.tagIds.sort();
        if (!isDeepStrictEqual(record.data, expected.data)) throw new HttpError(400, 'Imported values differ from the permitted domain record');
        const original = exchange.changes.find(change => change.changeId === item.changeId)!.record;
        // Rebased values require a laptop revision: the remote revision still
        // identifies the original proposal, never a rewritten payload.
        if (!resolution && isDeepStrictEqual(original, item.incoming)) {
          const updated = await client.query(`UPDATE transfer_changes SET change_id = $1, origin_device_id = $2, revision = $3
            WHERE entity_type = $4 AND entity_id = $5 AND revision = $6`,
          [item.changeId, exchange.sourceDeviceId, item.incoming.revision, record.entityType, record.entityId, record.revision]);
          if (updated.rowCount !== 1) throw new Error('Import did not produce exactly one journal change');
          await client.query('UPDATE transfer_states SET revision = $1 WHERE entity_type = $2 AND entity_id = $3',
            [item.incoming.revision, record.entityType, record.entityId]);
          record.revision = item.incoming.revision;
        }
      } else if (resolution && record) {
        // Keeping the laptop (including its tombstone) is a durable resolution,
        // not an acknowledgment that the incoming revision was applied.
        const revision = randomUUID();
        await client.query(`INSERT INTO transfer_changes(entity_type,entity_id,library_id,origin_device_id,
          previous_revision,revision,before_state,after_state)
          SELECT entity_type,entity_id,library_id,(SELECT device_id FROM transfer_device),revision,$1,state,state
          FROM transfer_states WHERE entity_type=$2 AND entity_id=$3`, [revision, record.entityType, record.entityId]);
        await client.query('UPDATE transfer_states SET revision=$1 WHERE entity_type=$2 AND entity_id=$3', [revision, record.entityType, record.entityId]);
        record = { ...record, revision };
      }
      outcomes.set(item.changeId, { changeId: item.changeId, action: discarded.has(item.changeId) ? 'discarded' : apply ? 'applied' : resolution ? 'local' : 'skipped', record });
    }
    const result: Result = { confirmedExchange: exchange, transferId: exchange.transferId, outcomes: exchange.changes.map(change => outcomes.get(change.changeId)!) };
    await client.query('INSERT INTO transfer_imports(transfer_id,user_id,request_sha256,result) VALUES($1,$2,$3,$4::json)',
      [exchange.transferId, userId, requestHash, JSON.stringify(result)]);
    for (const change of exchange.changes) if (!repeated.has(change.changeId)) {
      await client.query(`INSERT INTO transfer_import_changes(change_id,transfer_id,user_id,origin_device_id,proposal_sha256,proposal,outcome)
        VALUES($1,$2,$3,$4,$5,$6::json,$7::json)`, [change.changeId, exchange.transferId, userId, change.originDeviceId,
        hash(change), JSON.stringify(change), JSON.stringify(outcomes.get(change.changeId))]);
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function writeRecord(client: PoolClient, userId: number, record: SnapshotRecord) {
  if (!record.data) throw new HttpError(400, 'Unsupported companion operation');
  const id = record.entityId;
  switch (record.entityType) {
    case 'countries':
    case 'genres': {
      await client.query(`INSERT INTO ${record.entityType}(sync_id,name) VALUES($1,$2) ON CONFLICT(sync_id) DO UPDATE SET name=$2`, [id, record.data.name]); break;
    }
    case 'authors': {
      const d = record.data;
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      await client.query(`INSERT INTO authors(sync_id,first_name,middle_name,last_name,gender) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(sync_id) DO UPDATE SET first_name=$2,middle_name=$3,last_name=$4,gender=$5`,
      [id, d.firstName, d.middleName, d.lastName, d.gender]);
      await client.query('DELETE FROM author_countries WHERE author_id=(SELECT id FROM authors WHERE sync_id=$1)', [id]);
      await client.query('INSERT INTO author_countries(author_id,country_id) SELECT a.id,c.id FROM authors a CROSS JOIN countries c WHERE a.sync_id=$1 AND c.sync_id=ANY($2::uuid[])', [id, d.countryIds]);
      break;
    }
    case 'tags': {
      const d = record.data;
      await client.query(`INSERT INTO tags(sync_id,name,created_by_user_id) VALUES($1,$2,$3)
        ON CONFLICT(sync_id) DO UPDATE SET name=$2`, [id, d.name, userId]); break;
    }
    case 'books': {
      const d = record.data;
      await client.query(`INSERT INTO books(sync_id,title,author_id,genre_id,co_authors,category,page_count)
        VALUES($1,$2,(SELECT id FROM authors WHERE sync_id=$3),(SELECT id FROM genres WHERE sync_id=$4),$5,$6,$7)
        ON CONFLICT(sync_id) DO UPDATE SET title=excluded.title,author_id=excluded.author_id,genre_id=excluded.genre_id,
        co_authors=excluded.co_authors,category=excluded.category,page_count=excluded.page_count`,
      [id, d.title, d.authorId, d.genreId, d.coAuthors, d.category, d.pageCount]); break;
    }
    case 'readings': {
      const d = record.data;
      // A supplied baseline cannot authorize uncertain-date metadata edits.
      const current = (await client.query('SELECT date_uncertain FROM readings WHERE sync_id=$1 AND user_id=$2', [id, userId])).rows[0];
      const deleted = current ? null : (await client.query(`WITH RECURSIVE history AS (
        SELECT c.previous_revision,c.before_state,0 AS depth
        FROM transfer_states s JOIN transfer_changes c ON c.entity_type=s.entity_type AND c.entity_id=s.entity_id AND c.revision=s.revision
        WHERE s.entity_type='readings' AND s.entity_id=$1 AND s.state IS NULL AND s.library_id=(SELECT library_id FROM users WHERE id=$2)
        UNION ALL SELECT c.previous_revision,c.before_state,h.depth+1 FROM transfer_changes c
        JOIN history h ON c.revision=h.previous_revision WHERE c.entity_type='readings' AND c.entity_id=$1
        ) SELECT before_state->'fields'->>'date_uncertain' AS uncertain FROM history
        WHERE before_state IS NOT NULL ORDER BY depth LIMIT 1`,
      [id, userId])).rows[0];
      const uncertain = current?.date_uncertain ?? (deleted?.uncertain === 'true');
      if (d.dateUncertain !== uncertain) throw new HttpError(400, 'Companion cannot change uncertain-date metadata');
      await client.query(`INSERT INTO readings(sync_id,user_id,book_id,started_on,finished_on,date_uncertain,abandoned,format,rating,review)
        VALUES($1,$2,(SELECT id FROM books WHERE sync_id=$3),$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT(sync_id) DO UPDATE SET book_id=excluded.book_id,started_on=$4,finished_on=$5,
        abandoned=$7,format=$8,rating=$9,review=$10 WHERE readings.user_id=$2`,
      [id, userId, d.bookId, d.startedOn, d.finishedOn, d.dateUncertain, d.abandoned, d.format, d.rating, d.review]); break;
    }
    case 'bookTags': {
      const d = record.data;
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      const book = (await client.query('SELECT id FROM books WHERE sync_id=$1 FOR UPDATE', [d.bookId])).rows[0];
      if (!book) throw new HttpError(400, 'Tag selection references a missing book');
      await client.query('DELETE FROM book_tags WHERE user_id=$1 AND book_id=$2', [userId, book.id]);
      const inserted = await client.query(`INSERT INTO book_tags(user_id,book_id,tag_id)
        SELECT $1,$2,id FROM tags WHERE sync_id=ANY($3::uuid[])`, [userId, book.id, d.tagIds]);
      if (inserted.rowCount !== d.tagIds.length) throw new HttpError(400, 'Tag selection references a missing tag');
      // Also records an initially empty selection when there are no join rows.
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      await client.query('SELECT transfer_tag_set($1,$2)', [userId, book.id]); break;
    }
  }
}
