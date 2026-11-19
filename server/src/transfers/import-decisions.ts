import { HttpError } from '../middleware/errors.js';
import type { MergeItem } from './merge-planner.js';
import type { ImportCommitRequest } from './transfer-contract.js';

export function resolveImportChoices(items: MergeItem[], choices: ImportCommitRequest['choices']) {
  const selected = new Map(choices.map(value => [value.changeId, value.choice]));
  if (choices.some(value => !items.some(item => item.changeId === value.changeId && item.action === 'conflict'))) {
    throw new HttpError(400, 'Choices must identify conflicts in this preview');
  }
  return items.map(item => {
    if (item.action === 'blocked' || item.action === 'match') {
      throw new HttpError(409, 'Resolve blocked changes and duplicate matches before committing');
    }
    const choice = selected.get(item.changeId);
    if (item.action === 'conflict') {
      if (choice && item.allowedChoices && !item.allowedChoices.includes(choice)) throw new HttpError(400, 'This rename must keep the laptop name');
      if (!choice) throw new HttpError(400, 'Every conflict requires a whole-record choice');
      if (choice === 'restore' && item.local?.data !== null || choice === 'incoming' && item.local?.data === null) {
        throw new HttpError(400, 'Restoring a laptop deletion requires the restore choice');
      }
    }
    return { item, apply: item.action !== 'skip' && choice !== 'local', resolution: item.action === 'conflict' };
  });
}

// Preview permits conflicts as dependencies until the whole-record choice is
// known. A dependent write must not reference an entity the user kept absent.
export function validateSelectedReferences(decisions: ReturnType<typeof resolveImportChoices>) {
  const available = new Map(decisions.map(({ item, apply }) => [
    item.incoming.entityType + ':' + item.incoming.entityId, apply ? item.incoming.data : item.local?.data,
  ]));
  for (const { item, apply } of decisions) {
    if (!apply || !item.incoming.data) continue;
    const r = item.incoming;
    const refs: [string, string][] = [];
    if (r.entityType === 'authors' && r.data) refs.push(...r.data.countryIds.map(id => ['countries', id] as [string, string]));
    if (r.entityType === 'books' && r.data) refs.push(['authors', r.data.authorId], ['genres', r.data.genreId]);
    if ((r.entityType === 'readings' || r.entityType === 'bookTags') && r.data) refs.push(['books', r.data.bookId]);
    if (r.entityType === 'bookTags' && r.data) refs.push(...r.data.tagIds.map(id => ['tags', id] as [string, string]));
    if (refs.some(([type, id]) => available.has(type + ':' + id) && !available.get(type + ':' + id))) {
      throw new HttpError(409, 'An included change references a record kept absent; restore it or skip its dependent book');
    }
  }
}
