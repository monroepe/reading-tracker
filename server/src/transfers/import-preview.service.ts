import { discardedChanges } from './import-selection.js';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { pool } from '../db/index.js';
import { HttpError } from '../middleware/errors.js';
import { planChange, type MergeItem } from './merge-planner.js';
import { previewExchange, snapshotRecord, type PreviewExchange, type SnapshotRecord } from './transfer-contract.js';
import { aliasKey, remapRecord, type Alias } from './catalog-mappings.js';
import { importPreviewRequest, type CatalogMatch } from './transfer-contract.js';
import { project, type TrackedState } from './transfers.service.js';

const keyOf = (record: SnapshotRecord) => `${record.entityType}:${record.entityId}`;

// Stable digests do not depend on JSON object property insertion order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

export async function previewImport(userId: number, input: unknown, database: Pick<Pool, 'connect'> = pool) {
  const request = importPreviewRequest.safeParse(input);
  const exchange = request.success ? request.data.exchange : previewExchange.parse(input);
  const matches = request.success ? request.data.matches : [];
  const client = await database.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await buildPreview(client, userId, exchange, matches, request.success ? request.data.skippedBookIds : []);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function buildPreview(client: PoolClient, userId: number, exchange: PreviewExchange, matches: CatalogMatch[] = [], skippedBookIds: string[] = []) {
  const owner = (await client.query('SELECT library_id, role FROM users WHERE id = $1', [userId])).rows[0];
  if (!owner) throw new HttpError(401, 'Account no longer exists');
  const device = (await client.query('SELECT device_id FROM transfer_device')).rows[0];
  if (!device) throw new HttpError(503, 'Transfer device identity is not initialized');
  if (exchange.libraryId !== owner.library_id) throw new HttpError(400, 'File belongs to another library');
  if (exchange.destinationDeviceId !== device.device_id || exchange.sourceDeviceId === device.device_id) {
    throw new HttpError(400, 'File is addressed to a different device or originated here');
  }
  const privateIds = exchange.changes.flatMap(({ record, baseline }) => [record, ...(baseline ? [baseline] : [])])
    .filter(record => record.entityType === 'readings' || record.entityType === 'bookTags').map(record => record.entityId);
  const foreign = await client.query(`SELECT 1 FROM transfer_states
    WHERE entity_id = ANY($1::uuid[]) AND library_id IS NOT NULL AND library_id <> $2 LIMIT 1`, [privateIds, owner.library_id]);
  if (foreign.rowCount) throw new HttpError(400, 'File contains identities outside this library');
  const rows = await client.query<TrackedState>(`SELECT entity_type, entity_id, revision, state FROM transfer_states
    WHERE library_id IS NULL OR library_id = $1 ORDER BY entity_type, entity_id`, [owner.library_id]);
  const localRecords = rows.rows.map(row => snapshotRecord.parse(project(row, owner.library_id)));
  const locals = new Map(localRecords.map(record => [keyOf(record), record]));
  const saved = await client.query<{ entity_type: string; incoming_id: string; local_id: string }>(
    'SELECT entity_type,incoming_id,local_id FROM transfer_aliases WHERE user_id=$1 AND source_device_id=$2 ORDER BY entity_type,incoming_id',
    [userId, exchange.sourceDeviceId]);
  const aliases: Alias[] = saved.rows.map(row => ({ entityType: row.entity_type, incomingId: row.incoming_id, localId: row.local_id }));
  for (const match of matches) {
    const proposal = exchange.changes.find(c => c.record.entityType === match.entityType && c.record.entityId === match.incomingId);
    if (!proposal || !proposal.record.data || proposal.baseline || locals.has(aliasKey(match.entityType, match.incomingId))) throw new HttpError(400, 'Matches must identify new catalog proposals');
    if (aliases.some(a => a.entityType === match.entityType && a.incomingId === match.incomingId)) throw new HttpError(400, 'Saved matches cannot be changed');
    if (match.localId && !locals.get(aliasKey(match.entityType, match.localId))?.data) throw new HttpError(400, 'Match target must be a live catalog record');
    if (match.localId) aliases.push({ ...match, localId: match.localId });
  }
  const matchesInputConfirmed = (record: SnapshotRecord) => matches.some(m => m.entityType === record.entityType && m.incomingId === record.entityId && m.localId === null);
  const items: MergeItem[] = [];
  for (const change of [...exchange.changes].sort((a,b) => ['countries','genres','tags','authors','books','readings','bookTags'].indexOf(a.record.entityType) - ['countries','genres','tags','authors','books','readings','bookTags'].indexOf(b.record.entityType))) {
    const record = change.record;
    if (record.entityType === 'bookTags' && record.data) {
      const expected = createHash('md5').update(`${owner.library_id}:${record.data.bookId}`).digest('hex');
      if (record.entityId.replaceAll('-', '').toLowerCase() !== expected) throw new HttpError(400, 'Invalid personal tag-selection identity');
    }
    const local = locals.get(keyOf(record)) ?? null;
    const claimed = [record, ...(change.baseline ? [change.baseline] : [])];
    const known = await client.query<TrackedState>(`SELECT entity_type, entity_id, revision, state FROM transfer_states
      WHERE entity_type = $1 AND entity_id = $2 AND revision = ANY($3::uuid[])
      UNION ALL SELECT entity_type, entity_id, revision, after_state AS state FROM transfer_changes
      WHERE entity_type = $1 AND entity_id = $2 AND revision = ANY($3::uuid[])
      UNION ALL SELECT entity_type, entity_id, previous_revision AS revision, before_state AS state FROM transfer_changes
      WHERE entity_type = $1 AND entity_id = $2 AND previous_revision = ANY($3::uuid[])`,
    [record.entityType, record.entityId, claimed.map(value => value.revision)]);
    if (known.rows.some(row => !isDeepStrictEqual(project(row, owner.library_id).data,
      claimed.find(value => value.revision === row.revision)?.data))) {
      items.push({ changeId: change.changeId, action: 'blocked', reason: 'Known revision values were altered',
        incoming: record, local, candidates: [] });
      continue;
    }
    // Conflict proposals may be retained without adopting their revision in the
    // laptop journal. Their revision identities are still immutable.
    const proposals = await client.query<{ proposal: { record: SnapshotRecord; baseline: SnapshotRecord | null } }>(
      `SELECT proposal FROM transfer_import_changes WHERE user_id=$1
       AND proposal->'record'->>'entityType'=$2 AND proposal->'record'->>'entityId'=$3`,
      [userId, record.entityType, record.entityId]);
    const retained = proposals.rows.flatMap(({ proposal }) => [proposal.record, ...(proposal.baseline ? [proposal.baseline] : [])]);
    if (claimed.some(value => retained.some(prior => prior.revision === value.revision && !isDeepStrictEqual(prior.data, value.data)))) {
      items.push({ changeId: change.changeId, action: 'blocked', reason: 'Retained proposal revision values were altered',
        incoming: record, local, candidates: [] });
      continue;
    }
    const processed = (await client.query('SELECT proposal, outcome, user_id, origin_device_id FROM transfer_import_changes WHERE change_id=$1', [change.changeId])).rows[0];
    if (processed) {
      if (processed.user_id !== userId || processed.origin_device_id !== exchange.sourceDeviceId || !isDeepStrictEqual(processed.proposal, change)) {
        throw new HttpError(409, 'Change identity was already used with different content');
      }
      items.push({ changeId: change.changeId, action: 'skip', reason: 'Already imported', incoming: record, local, candidates: [] });
      continue;
    }
    // Walk ancestry, never UUID or wall-clock ordering. Only this entity/library
    // participates, so another user's history cannot affect the result.
    let stale = false;
    if (local && local.revision !== record.revision) {
      const ancestry = await client.query(`WITH RECURSIVE chain(revision, previous_revision) AS (
        SELECT revision, previous_revision FROM transfer_changes
        WHERE entity_type = $1 AND entity_id = $2 AND revision = $3
        UNION
        SELECT c.revision, c.previous_revision FROM transfer_changes c JOIN chain p ON c.revision = p.previous_revision
        WHERE c.entity_type = $1 AND c.entity_id = $2
      ) SELECT 1 FROM chain WHERE previous_revision = $4 LIMIT 1`, [record.entityType, record.entityId, local.revision, record.revision]);
      stale = !!ancestry.rowCount;
    }
    let matchIds: string[] = [];
    if (!local && record.data) {
      if (record.entityType === 'countries' || record.entityType === 'genres') matchIds = (await client.query(`SELECT sync_id FROM ${record.entityType} WHERE lower(name)=lower($1)`, [record.data.name])).rows.map(row => row.sync_id);
      if (record.entityType === 'tags') matchIds = (await client.query('SELECT sync_id FROM tags WHERE lower(name) = lower($1)', [record.data.name])).rows.map(row => row.sync_id);
      if (record.entityType === 'authors') matchIds = (await client.query(`SELECT sync_id FROM authors WHERE lower(first_name) = lower($1)
        AND lower(middle_name) = lower($2) AND lower(last_name) = lower($3)`, [record.data.firstName, record.data.middleName, record.data.lastName])).rows.map(row => row.sync_id);
      if (record.entityType === 'books') matchIds = (await client.query(`SELECT b.sync_id FROM books b JOIN authors a ON a.id = b.author_id
        WHERE lower(b.title) = lower($1) AND a.sync_id = $2`, [record.data.title, aliases.find(a => a.entityType === 'authors' && a.incomingId === record.data!.authorId)?.localId ?? record.data.authorId])).rows.map(row => row.sync_id);
    }
    const candidates = matchIds.map(id => locals.get(`${record.entityType}:${id}`)!);
    // Resolve catalog links before planning dependent books/readings/tag selections.
    let alias = aliases.find(a => a.entityType === record.entityType && a.incomingId === record.entityId);
    if (!local && ['tags','countries','genres'].includes(record.entityType) && !change.baseline && record.data && candidates.length === 1 && !alias) {
      alias = { entityType: record.entityType, incomingId: record.entityId, localId: candidates[0].entityId };
      aliases.push(alias);
    }
    if (alias) {
      const target = locals.get(aliasKey(alias.entityType, alias.localId));
      items.push({ changeId: change.changeId, incoming: record, local: target ?? null, candidates,
        action: !target?.data || change.baseline || !record.data ? 'blocked' : 'skip',
        reason: !target?.data ? 'Saved match target was deleted' : !record.data ? 'Companion deletion is not supported' : change.baseline ? 'Editing mapped catalog metadata requires laptop review' : 'Catalog identity matched; laptop metadata retained' });
      continue;
    }
    const mapped = remapRecord(record, aliases, owner.library_id);
    const mappedLocal = locals.get(keyOf(mapped)) ?? null;
    const planned = planChange({ ...change, record: mapped, baseline: change.baseline ? remapRecord(change.baseline, aliases, owner.library_id) : null }, mappedLocal, matchesInputConfirmed(record) ? [] : candidates, owner.role === 'admin', stale);
    if (!local && !change.baseline && record.data && ['authors','books','countries','genres'].includes(record.entityType) && !matchesInputConfirmed(record)) {
      planned.action = 'match'; planned.reason = 'Confirm a catalog match or explicitly create a new record';
    }
    if (matchesInputConfirmed(record) && candidates.length) {
      planned.action = 'blocked'; planned.reason = 'Catalog uniqueness rules require matching the existing record';
    }
    items.push(planned);
  }
  // A rename is never a merge. Keep colliding names as explicit laptop-only decisions.
  for (const item of items) {
    const r = item.incoming;
    if (!r.data || !['countries','genres'].includes(r.entityType) || !('name' in r.data) || ['skip','match','blocked'].includes(item.action)) continue;
    const name = r.data.name.trim().toLowerCase();
    const collision = localRecords.some(other => other.entityType===r.entityType && other.entityId!==r.entityId && other.data && 'name' in other.data && other.data.name.trim().toLowerCase()===name)
      || items.some(other => other!==item && other.incoming.entityType===r.entityType && other.incoming.entityId!==r.entityId && other.action!=='skip' && other.incoming.data && 'name' in other.incoming.data && other.incoming.data.name.trim().toLowerCase()===name);
    if (collision && item.local?.data) {
      item.action='conflict';item.reason='This name already exists. Keep the laptop name; merging is not supported.';item.allowedChoices=['local'];
    } else if (collision) {
      item.action='blocked';item.reason='Duplicate incoming catalog names must be corrected on the phone before export.';
    }
  }
  const completed = (await client.query('SELECT user_id, result FROM transfer_imports WHERE transfer_id=$1', [exchange.transferId])).rows[0];
  if (completed && (completed.user_id !== userId || completed.result.outcomes.length !== exchange.changes.length ||
    !completed.result.outcomes.every((outcome: { changeId: string }, index: number) =>
      outcome.changeId === exchange.changes[index].changeId && items.some(item => item.changeId === outcome.changeId && item.reason === 'Already imported')))) {
    throw new HttpError(409, 'Transfer identity was already used for a different import');
  }
  const discarded = discardedChanges(exchange, skippedBookIds, aliases);
  for (const item of items) if (discarded.has(item.changeId) && !completed) {
    if (item.action === 'blocked' && /revision|Baseline values/.test(item.reason)) {
      throw new HttpError(400, 'Cannot discard a proposal with altered revision values');
    }
    item.action = 'skip'; item.reason = 'Discarded phone changes';
  }
  const writtenIdentities = new Set<string>();
  for (const item of items) {
    if (item.action === 'skip' || item.action === 'blocked' || item.action === 'match') continue;
    const key = keyOf(item.incoming);
    if (writtenIdentities.has(key)) {
      item.action = 'blocked'; item.reason = 'Multiple proposals resolve to the same laptop record';
    }
    writtenIdentities.add(key);
  }
  const automaticTagMappings = aliases.filter(a => a.entityType === 'tags');
  const incomingItems = new Map(items.map(item => [keyOf(item.incoming), item]));
  const referenceIssues: { changeId: string; message: string }[] = [];
  for (const item of items) {
    const record = item.incoming;
    if (!record.data || item.action === 'skip') continue;
    const refs: [string, string][] = [];
    if (record.entityType === 'authors') refs.push(...record.data.countryIds.map(id => ['countries', id] as [string, string]));
    if (record.entityType === 'books') refs.push(['authors', record.data.authorId], ['genres', record.data.genreId]);
    if (record.entityType === 'readings' || record.entityType === 'bookTags') refs.push(['books', record.data.bookId]);
    if (record.entityType === 'bookTags') refs.push(...record.data.tagIds.map(id => ['tags', id] as [string, string]));
    for (const [type, id] of refs) {
      const dependency = incomingItems.get(`${type}:${id}`);
      if (dependency && !['insert', 'update', 'skip', 'conflict'].includes(dependency.action)) {
        referenceIssues.push({ changeId: item.changeId, message: `Resolve dependency first: ${type}:${id}` });
      } else if (!locals.get(`${type}:${id}`)?.data && !(dependency && ['insert', 'update', 'conflict'].includes(dependency.action))) {
        referenceIssues.push({ changeId: item.changeId, message: `Missing live reference: ${type}:${id}` });
      }
    }
  }
  // Preview never acknowledges receipt or changes records. Commit support must
  // replan with this digest inside its own write transaction before applying data.
  const previewDigest = createHash('sha256').update(JSON.stringify(canonical({ exchange, matches, ...(skippedBookIds.length ? { skippedBookIds: [...skippedBookIds].sort() } : {}), aliases, localRecords, role: owner.role, items, referenceIssues }))).digest('hex');
  const counts = { insert: 0, update: 0, skip: 0, conflict: 0, match: 0, blocked: 0 };
  for (const item of items) counts[item.action]++;
  const references = Object.fromEntries([...localRecords, ...exchange.changes.map(change => change.record)].filter(record => record.data).map(record => [keyOf(record), record.entityType === 'authors' && record.data ? [record.data.firstName, record.data.lastName].join(' ') : String(record.data && ('title' in record.data ? record.data.title : 'name' in record.data ? record.data.name : record.entityType))]));
  return { discardedChangeIds: [...discarded], completedResult: completed?.result as { transferId: string; outcomes: { changeId: string; action: string }[] } | undefined, references, localReferences: Object.fromEntries(localRecords.filter(r => r.data).map(r => [keyOf(r), r.entityType === 'authors' ? [r.data?.firstName, r.data?.middleName, r.data?.lastName].filter(Boolean).join(' ') : String(r.data && ('title' in r.data ? r.data.title : 'name' in r.data ? r.data.name : r.entityType))])), transferId: exchange.transferId, previewDigest, counts, items, aliases, automaticTagMappings, referenceIssues,
    requiresReview: items.some(item => item.action === 'conflict' || item.action === 'match' && item.incoming.entityType !== 'tags'),
    hasBlockingIssues: counts.blocked > 0 || referenceIssues.length > 0,
  };
}
