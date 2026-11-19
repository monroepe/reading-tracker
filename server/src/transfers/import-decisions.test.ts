import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { resolveImportChoices, validateSelectedReferences } from './import-decisions.js';
import type { MergeItem } from './merge-planner.js';

const record = { entityType: 'authors' as const, entityId: randomUUID(), revision: randomUUID(),
  data: { firstName: '', middleName: '', lastName: 'Author', countryIds: [], gender: null } };
const item: MergeItem = { changeId: randomUUID(), action: 'conflict', reason: 'Diverged', incoming: record, local: record, candidates: [] };
it('requires a complete-record choice for every conflict', () => {
  expect(() => resolveImportChoices([item], [])).toThrow('Every conflict');
  expect(resolveImportChoices([item], [{ changeId: item.changeId, choice: 'incoming' }])[0].apply).toBe(true);
  expect(resolveImportChoices([item], [{ changeId: item.changeId, choice: 'local' }])[0].apply).toBe(false);
});
it('requires explicit restoration of a laptop tombstone', () => {
  const deleted = { ...item, local: { ...record, data: null } };
  expect(() => resolveImportChoices([deleted], [{ changeId: item.changeId, choice: 'incoming' }])).toThrow('restore choice');
  expect(resolveImportChoices([deleted], [{ changeId: item.changeId, choice: 'restore' }])[0].apply).toBe(true);
  expect(resolveImportChoices([deleted], [{ changeId: item.changeId, choice: 'local' }])[0].apply).toBe(false);
  expect(() => resolveImportChoices([item], [{ changeId: item.changeId, choice: 'restore' }])).toThrow();
});
it('rejects unresolved matches, policy blocks, and extra choices', () => {
  for (const action of ['match', 'blocked'] as const) expect(() => resolveImportChoices([{ ...item, action }], [])).toThrow('Resolve blocked');
  expect(() => resolveImportChoices([item], [{ changeId: randomUUID(), choice: 'local' }])).toThrow('Choices must identify');
  expect(() => resolveImportChoices([{ ...item, action: 'update' }], [{ changeId: item.changeId, choice: 'incoming' }])).toThrow();
});
it('applies safe writes and preserves skips without choices', () => {
  expect(resolveImportChoices([{ ...item, action: 'update' }, { ...item, action: 'skip' }], []).map(value => value.apply)).toEqual([true, false]);
});

it('rejects dependent writes when their parent is kept deleted, and permits restoration', () => {
  const parent = { ...item, local: { ...record, data: null } };
  const book: MergeItem = { ...item, changeId: randomUUID(), action: 'insert', local: null, incoming: {
    entityType: 'books', entityId: randomUUID(), revision: randomUUID(), data: {
      title: 'New', authorId: record.entityId, genreId: randomUUID(), coAuthors: null, category: 'Fiction', pageCount: 100,
    },
  } };
  expect(() => validateSelectedReferences(resolveImportChoices([parent, book], [{ changeId: parent.changeId, choice: 'local' }]))).toThrow('kept absent');
  expect(() => validateSelectedReferences(resolveImportChoices([parent, book], [{ changeId: parent.changeId, choice: 'restore' }]))).not.toThrow();
});

it('permits only the laptop choice for a colliding catalog rename', () => {
  const collision: MergeItem = { ...item, allowedChoices: ['local'] };
  expect(()=>resolveImportChoices([collision],[{changeId:item.changeId,choice:'incoming'}])).toThrow('keep the laptop');
  expect(resolveImportChoices([collision],[{changeId:item.changeId,choice:'local'}])[0].apply).toBe(false);
});
