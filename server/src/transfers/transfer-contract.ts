import { z } from 'zod';

// Pure contract: safe to reuse in a browser/native bundle; no server imports.
const identity = z.uuid();
const name = z.string().refine(value => value.trim().length > 0, 'Expected nonblank text');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const reading = z.strictObject({
  bookId: identity, startedOn: day, finishedOn: day.nullable(),
  dateUncertain: z.boolean(), abandoned: z.boolean(),
  format: z.enum(['Print', 'Kindle', 'Audiobook', 'Graphic Novel']),
  rating: z.number().min(0.5).max(10).multipleOf(0.5).nullable(),
  review: z.string().nullable(),
}).refine(value => !value.finishedOn || value.finishedOn >= value.startedOn, 'Finish precedes start')
  .refine(value => !(value.abandoned && value.finishedOn), 'Abandoned reading has a finish date');
const base = { entityId: identity, revision: identity };

export const snapshotRecord = z.discriminatedUnion('entityType', [
  z.strictObject({ ...base, entityType: z.literal('authors'), data: z.strictObject({
    firstName: z.string(), middleName: z.string(), lastName: name,
    countryIds: z.array(identity).refine(ids => new Set(ids).size === ids.length, 'Duplicate countries'), gender: z.enum(['Female', 'Male', 'Non-binary']).nullable(),
  }).nullable() }),
  z.strictObject({ ...base, entityType: z.literal('countries'), data: z.strictObject({ name }).nullable() }),
  z.strictObject({ ...base, entityType: z.literal('genres'), data: z.strictObject({ name }).nullable() }),
  z.strictObject({ ...base, entityType: z.literal('tags'), data: z.strictObject({
    name, ownedByLibrary: z.boolean(),
  }).nullable() }),
  z.strictObject({ ...base, entityType: z.literal('books'), data: z.strictObject({
    title: name, authorId: identity, genreId: identity, coAuthors: z.string().nullable(),
    category: z.enum(['Fiction', 'Non-fiction']), pageCount: z.number().int().positive(),
  }).nullable() }),
  z.strictObject({ ...base, entityType: z.literal('readings'), data: reading.nullable() }),
  // Book-tag identities are MD5-derived PostgreSQL UUIDs without RFC version bits.
  z.strictObject({ ...base, entityId: z.guid(), entityType: z.literal('bookTags'), data: z.strictObject({
    bookId: identity, tagIds: z.array(identity).refine(ids => new Set(ids).size === ids.length, 'Duplicate tags'),
  }).nullable() }),
]);

export const snapshotExchange = z.strictObject({
  format: z.literal('reading-tracker'), version: z.literal(2), kind: z.literal('snapshot'), createdAt: z.iso.datetime().optional(),
  transferId: identity, sourceDeviceId: identity, destinationDeviceId: identity.nullable(),
  libraryId: identity, records: z.array(snapshotRecord),
}).superRefine((value, ctx) => {
  const records = new Map<string, z.infer<typeof snapshotRecord>>();
  for (const record of value.records) {
    const key = `${record.entityType}:${record.entityId}`;
    if (records.has(key)) ctx.addIssue({ code: 'custom', message: `Duplicate record: ${key}` });
    records.set(key, record);
  }
  const requireReference = (type: string, id: string) => {
    if (!records.get(`${type}:${id}`)?.data) ctx.addIssue({ code: 'custom', message: `Missing live reference: ${type}:${id}` });
  };
  for (const record of value.records) {
    if (!record.data) continue;
    if (record.entityType === 'authors') {
      for (const id of record.data.countryIds) requireReference('countries', id);
    } else if (record.entityType === 'books') {
      requireReference('authors', record.data.authorId);
      requireReference('genres', record.data.genreId);
    } else if (record.entityType === 'readings' || record.entityType === 'bookTags') {
      requireReference('books', record.data.bookId);
      if (record.entityType === 'bookTags') for (const id of record.data.tagIds) requireReference('tags', id);
    }
  }
});

export type SnapshotExchange = z.infer<typeof snapshotExchange>;
export type SnapshotRecord = z.infer<typeof snapshotRecord>;
export const exportRequest = z.strictObject({
  kind: z.literal('snapshot'), destinationDeviceId: identity.nullable().default(null),
});

export const incomingChange = z.strictObject({
  changeId: identity, originDeviceId: identity,
  baseline: snapshotRecord.nullable(), record: snapshotRecord,
}).superRefine((change, ctx) => {
  if (change.baseline && (change.baseline.entityType !== change.record.entityType || change.baseline.entityId !== change.record.entityId)) {
    ctx.addIssue({ code: 'custom', message: 'Baseline must identify the changed record' });
  }
  if (change.baseline?.revision === change.record.revision) {
    ctx.addIssue({ code: 'custom', message: 'A change must introduce a new revision' });
  }
});

// One proposed final change per entity; full phone delivery/acknowledgment
// semantics remain separate from this proposal contract.
export const previewExchange = z.strictObject({
  format: z.literal('reading-tracker'), version: z.literal(2), kind: z.literal('changes'), createdAt: z.iso.datetime().optional(),
  transferId: identity, sourceDeviceId: identity, destinationDeviceId: identity,
  libraryId: identity, changes: z.array(incomingChange).max(10000),
}).superRefine((value, ctx) => {
  const changes = new Set<string>(), records = new Set<string>();
  for (const change of value.changes) {
    const key = `${change.record.entityType}:${change.record.entityId}`;
    if (changes.has(change.changeId) || records.has(key)) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate change or entity identity' });
    }
    if (change.originDeviceId !== value.sourceDeviceId) {
      ctx.addIssue({ code: 'custom', message: 'Companion changes must originate on the sending device' });
    }
    changes.add(change.changeId); records.add(key);
  }
});
export type PreviewExchange = z.infer<typeof previewExchange>;
export type IncomingChange = z.infer<typeof incomingChange>;

export const catalogMatch = z.strictObject({
  entityType: z.enum(['authors', 'books', 'countries', 'genres']), incomingId: identity,
  // null explicitly confirms that this is a new catalog record.
  localId: identity.nullable(),
});
export const catalogMatches = z.array(catalogMatch).max(10000).default([]).refine(
  values => new Set(values.map(value => `${value.entityType}:${value.incomingId}`)).size === values.length,
  'Duplicate catalog match');
export type CatalogMatch = z.infer<typeof catalogMatch>;
const skippedBooks = z.array(identity).max(10000).refine(ids => new Set(ids).size === ids.length, 'Duplicate skipped book').optional();
export const importPreviewRequest = z.strictObject({ exchange: previewExchange, matches: catalogMatches, skippedBookIds: skippedBooks });

export const importCommitRequest = z.strictObject({
  exchange: previewExchange,
  matches: catalogMatches,
  skippedBookIds: skippedBooks,
  previewDigest: z.string().regex(/^[a-f0-9]{64}$/),
  choices: z.array(z.strictObject({
    changeId: identity,
    choice: z.enum(['local', 'incoming', 'restore']),
  })).max(10000),
}).refine(value => new Set(value.choices.map(choice => choice.changeId)).size === value.choices.length,
  'Duplicate conflict choice');
export type ImportCommitRequest = z.infer<typeof importCommitRequest>;

// A refresh is a complete replacement, confirmed against the frozen phone file.
export const phoneRefresh = z.strictObject({
  format: z.literal('reading-tracker'), version: z.literal(2), kind: z.literal('phone-refresh'), createdAt: z.iso.datetime().optional(),
  exchange: previewExchange,
  snapshot: snapshotExchange,
}).superRefine(({ exchange, snapshot }, ctx) => {
  if (exchange.libraryId !== snapshot.libraryId || exchange.sourceDeviceId !== snapshot.destinationDeviceId || exchange.destinationDeviceId !== snapshot.sourceDeviceId)
    ctx.addIssue({ code: 'custom', message: 'Refresh identities do not match the confirmed exchange' });
});
export type PhoneRefresh = z.infer<typeof phoneRefresh>;
