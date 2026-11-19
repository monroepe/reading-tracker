import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { importCommitRequest } from './transfer-contract.js';

const request = {
  exchange: { format: 'reading-tracker', version: 2, kind: 'changes', transferId: randomUUID(),
    sourceDeviceId: randomUUID(), destinationDeviceId: randomUUID(), libraryId: randomUUID(), changes: [] },
  previewDigest: 'a'.repeat(64), choices: [],
};
it('accepts a strict commit envelope and rejects caller-selected ownership', () => {
  expect(importCommitRequest.safeParse(request).success).toBe(true);
  expect(importCommitRequest.safeParse({ ...request, userId: 2 }).success).toBe(false);
});
it('rejects malformed digests and duplicate or invalid choices', () => {
  expect(importCommitRequest.safeParse({ ...request, previewDigest: 'stale' }).success).toBe(false);
  const choice = { changeId: randomUUID(), choice: 'local' };
  expect(importCommitRequest.safeParse({ ...request, choices: [choice, choice] }).success).toBe(false);
  expect(importCommitRequest.safeParse({ ...request, choices: [{ ...choice, choice: 'merge' }] }).success).toBe(false);
});

it('validates explicit catalog matching separately from conflict choices', () => {
  const match = { entityType: 'authors', incomingId: randomUUID(), localId: null };
  expect(importCommitRequest.safeParse({ ...request, matches: [match] }).success).toBe(true);
  expect(importCommitRequest.safeParse({ ...request, matches: [match, match] }).success).toBe(false);
  expect(importCommitRequest.safeParse({ ...request, matches: [{ ...match, entityType: 'readings' }] }).success).toBe(false);
});

it('accepts optional whole-book discard selections and rejects malformed or duplicate IDs', () => {
  const id = randomUUID();
  expect(importCommitRequest.safeParse({ ...request, skippedBookIds: [id] }).success).toBe(true);
  expect(importCommitRequest.safeParse({ ...request, skippedBookIds: [id, id] }).success).toBe(false);
  expect(importCommitRequest.safeParse({ ...request, skippedBookIds: ['book'] }).success).toBe(false);
});
