import { exportFilename } from '@/lib/exportFilename';
export type RecordValue = { entityType: string; entityId: string; data: Record<string, unknown> | null };
export type Item = { allowedChoices?: string[]; changeId: string; action: string; reason: string; incoming: RecordValue; local: RecordValue | null; candidates: RecordValue[] };
export type Match = { entityType: string; incomingId: string; localId: string | null };
export type Exchange = { changes: { changeId: string; record: RecordValue; baseline: RecordValue | null }[] };
export type Result = { transferId: string; outcomes: { action: string }[] };
export type Preview = {
  completedResult?: Result; previewDigest: string; items: Item[];
  references: Record<string, string>; localReferences?: Record<string, string>;
  aliases?: { entityType: string; incomingId: string; localId: string }[];
  discardedChangeIds?: string[]; hasBlockingIssues: boolean;
  referenceIssues: { changeId: string; message: string }[];
};
export type Session = { filename: string; exchange: Exchange; preview: Preview };
export type Group = { id: string; title: string; items: Item[]; bookId?: string };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Transfer failed';
export function groupChanges(exchange: Exchange, preview: Preview): Group[] {
  const groups = new Map<string, Group>();
  for (const item of preview.items) {
    const original = exchange.changes.find(c => c.changeId === item.changeId)?.record ?? item.incoming;
    const bookId = original.entityType === 'books' ? original.entityId
      : ['readings', 'bookTags'].includes(original.entityType) ? String(original.data?.bookId ?? '') : undefined;
    const canonicalId = bookId && (preview.aliases?.find(a => a.entityType === 'books' && a.incomingId === bookId)?.localId ?? bookId);
    const id = canonicalId ? 'books:' + canonicalId : original.entityType + ':' + original.entityId;
    const book = exchange.changes.find(c => c.record.entityType === 'books' && c.record.entityId === bookId)?.record;
    const title = bookId ? String(book?.data?.title ?? preview.references['books:' + canonicalId] ?? preview.references['books:' + bookId] ?? 'Book')
      : recordName(item.incoming, preview.references);
    const group = groups.get(id) ?? { id, title, items: [], bookId };
    group.items.push(item); groups.set(id, group);
  }
  return [...groups.values()];
}
export function recordName(record: RecordValue, references: Record<string, string>) {
  return String(record.data?.title ?? record.data?.name ?? (record.entityType === 'authors'
    ? [record.data?.firstName, record.data?.middleName, record.data?.lastName].filter(Boolean).join(' ')
    : references['books:' + record.data?.bookId] ?? 'Reading'));
}
export function needsDecision(item: Item, choices: Record<string, string>) {
  return item.action === 'match' || item.action === 'conflict' && !choices[item.changeId] || item.action === 'blocked';
}
export async function downloadTransfer(importId?: string) {
  const { api } = await import('@/api/client');
  const payload = await api<{ createdAt?: string; transferId?: string; snapshot?: { transferId: string } }>(importId ? '/transfers/refreshes' : '/transfers/exports',
    { method: 'POST', body: importId ? { importId } : { kind: 'snapshot' } });
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = exportFilename(importId ? 'phone-refresh' : 'phone-setup', payload.createdAt ?? new Date().toISOString());
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const entityLabels: Record<string, string> = { books: 'Book', authors: 'Author', tags: 'Tag', countries: 'Country', genres: 'Genre', readings: 'Reading', bookTags: 'Tags' };
export function changeTitle(item: Item) {
  const entity = entityLabels[item.incoming.entityType] ?? 'Change';
  if (item.reason === 'Discarded phone changes') return entity + ' changes — will be discarded';
  if (item.action === 'match') return item.candidates.length ? 'Possible duplicate ' + entity.toLowerCase() : 'New ' + entity.toLowerCase();
  if (item.incoming.entityType === 'bookTags') return item.action === 'skip' ? 'Tags — no change needed' : 'Tags updated';
  if (item.action === 'skip') return item.reason.includes('matched') ? entity + ' matched — laptop details kept' : entity + ' — no change needed';
  return item.action === 'insert' ? 'New ' + entity.toLowerCase() : entity + ' updated';
}


export function reviewSummary(preview: Preview) {
  const counts = new Map<string, { count: number; plural: string }>();
  const nouns: Record<string, [string, string]> = {
    books: ['book', 'books'], authors: ['author', 'authors'], tags: ['tag', 'tags'],
    countries: ['country', 'countries'], genres: ['genre', 'genres'], readings: ['reading', 'readings'],
  };
  for (const item of preview.items) {
    if (item.action === 'skip') continue;
    const type = item.incoming.entityType;
    const [one, many] = nouns[type] ?? ['change', 'changes'];
    const prefix = item.action === 'match' && item.candidates.length ? 'possible duplicate '
      : item.action === 'insert' || item.action === 'match' ? 'new ' : '';
    const suffix = prefix ? '' : ' updated';
    const single = type === 'bookTags' ? 'book’s tags updated' : prefix + one + suffix;
    const plural = type === 'bookTags' ? 'books’ tags updated' : prefix + many + suffix;
    counts.set(single, { count: (counts.get(single)?.count ?? 0) + 1, plural });
  }
  return [...counts].map(([single, { count, plural }]) => count + ' ' + (count === 1 ? single : plural)).join(' · ') || 'No included library changes needed';
}
