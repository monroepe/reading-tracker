import { expect, it } from 'vitest';
import { groupChanges } from './transferReview';
import type { Exchange, Item, Preview } from './transferReview';
it('groups separate readings and tag selections under the canonical book, while authors stay separate', () => {
  const record = (entityType: string, entityId: string, data: Record<string, unknown>) => ({ entityType, entityId, data });
  const records = [
    record('books', 'phone-book', { title: 'New title' }),
    record('readings', 'first', { bookId: 'phone-book', startedOn: '2026-10-01' }),
    record('readings', 'second', { bookId: 'phone-book', startedOn: '2026-11-01' }),
    record('bookTags', 'tags', { bookId: 'phone-book', tagIds: [] }),
    record('authors', 'author', { firstName: 'New', lastName: 'Author' }),
  ];
  const exchange: Exchange = { changes: records.map((record, index) => ({ changeId: String(index), baseline: null, record })) };
  const items: Item[] = records.map((incoming, index) => ({ changeId: String(index), action: 'insert', reason: 'New record', incoming, local: null, candidates: [] }));
  const preview: Preview = { items, previewDigest: 'digest', references: {}, referenceIssues: [], hasBlockingIssues: false, aliases: [{ entityType: 'books', incomingId: 'phone-book', localId: 'laptop-book' }] };
  const groups = groupChanges(exchange, preview);
  expect(groups).toHaveLength(2);
  expect(groups[0].id).toBe('books:laptop-book');
  expect(groups[0].items).toHaveLength(4);
  expect(groups[0].title).toBe('New title');
  expect(groups[1].title).toBe('New Author');
});
