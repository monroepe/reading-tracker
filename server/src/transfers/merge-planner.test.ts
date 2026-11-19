import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { planChange } from './merge-planner.js';
import type { IncomingChange, SnapshotRecord } from './transfer-contract.js';

const local: Extract<SnapshotRecord, { entityType: 'authors' }> = { entityType: 'authors', entityId: randomUUID(), revision: randomUUID(),
  data: { firstName: '', middleName: '', lastName: 'Author', countryIds: [], gender: null } };
function change(): IncomingChange {
  return { changeId: randomUUID(), originDeviceId: randomUUID(), baseline: local,
    record: { ...local, revision: randomUUID(), data: { ...local.data!, countryIds: [randomUUID()] } } };
}
it('accepts an unchanged baseline and detects divergent edits', () => {
  const incoming = change();
  expect(planChange(incoming, local, [], true, false).action).toBe('update');
  expect(planChange(incoming, { ...local, revision: randomUUID() }, [], true, false).action).toBe('conflict');
});
it('skips identical results and known ancestors', () => {
  const incoming = change();
  expect(planChange(incoming, incoming.record, [], true, false).action).toBe('skip');
  expect(planChange(incoming, local, [], true, true).action).toBe('skip');
});
it('blocks reused revisions and fabricated baseline values', () => {
  const incoming = change();
  expect(planChange({ ...incoming, record: { ...incoming.record, revision: local.revision } }, local, [], true, false).action).toBe('blocked');
  expect(planChange({ ...incoming, baseline: incoming.record }, { ...local, revision: incoming.record.revision }, [], true, false).action).toBe('blocked');
});
it('requires review for catalog duplicates and deletion conflicts', () => {
  const incoming = { ...change(), baseline: null };
  expect(planChange(incoming, null, [local], true, false).action).toBe('match');
  expect(planChange(incoming, { ...local, data: null }, [], true, false).action).toBe('conflict');
});
it('allows creation but blocks shared catalog updates for non-admin users', () => {
  const incoming = change();
  expect(planChange(incoming, local, [], false, false).action).toBe('blocked');
  expect(planChange({ ...incoming, baseline: null }, null, [], false, false).action).toBe('insert');
});
