import { isDeepStrictEqual } from 'node:util';
import type { IncomingChange, SnapshotRecord } from './transfer-contract.js';

export type MergeAction = 'insert' | 'update' | 'skip' | 'conflict' | 'match' | 'blocked';
export type MergeItem = {
  allowedChoices?: ('local' | 'incoming' | 'restore')[];
  changeId: string; action: MergeAction; reason: string;
  incoming: SnapshotRecord; local: SnapshotRecord | null; candidates: SnapshotRecord[];
};

export function planChange(
  change: IncomingChange, local: SnapshotRecord | null,
  candidates: SnapshotRecord[], admin: boolean, stale: boolean,
): MergeItem {
  const item = (action: MergeAction, reason: string): MergeItem => ({
    changeId: change.changeId, action, reason, incoming: change.record, local, candidates,
  });
  const { record, baseline } = change;
  if (local?.revision === record.revision && !isDeepStrictEqual(local.data, record.data)) {
    return item('blocked', 'Revision identity was reused with different values');
  }
  if (local && isDeepStrictEqual(local.data, record.data)) return item('skip', 'Same result');
  if (stale) return item('skip', 'Incoming revision is an ancestor of the current revision');
  if (baseline && local?.revision === baseline.revision && !isDeepStrictEqual(local.data, baseline.data)) {
    return item('blocked', 'Baseline values do not match the known revision');
  }
  if (record.data === null) return item('blocked', 'Companion deletion is not supported');
  if (['countries','genres'].includes(record.entityType) && !admin) return item('blocked', 'Catalog management requires admin access');
  if (record.entityType === 'readings') {
    const previous = local?.entityType === 'readings' && local.data
      ? local.data : baseline?.entityType === 'readings' ? baseline.data : null;
    if (record.data.dateUncertain && !previous?.dateUncertain || previous && record.data.dateUncertain !== previous.dateUncertain) {
      return item('blocked', 'Companion cannot change uncertain-date metadata');
    }
  }
  if (record.entityType === 'tags' && !record.data.ownedByLibrary && !local) {
    return item('blocked', 'New tags must belong to this library');
  }
  if (!local && candidates.length) return item('match', record.entityType === 'tags'
    ? 'Tag name matches an existing tag' : 'Explicit catalog matching is required');
  if (local && ['authors', 'books', 'tags'].includes(record.entityType) && !admin) {
    return item('blocked', 'Changing shared catalog metadata requires admin access');
  }
  if (!local) return baseline
    ? item('conflict', 'Baseline is not known on this laptop')
    : item('insert', 'New record');
  if (local.data === null) return item('conflict', 'Laptop deleted this record; choose deletion or explicit restoration');
  if (baseline && local.revision === baseline.revision) return item('update', 'Laptop still matches the baseline');
  return item('conflict', 'Laptop and companion diverged; choose one complete record');
}
