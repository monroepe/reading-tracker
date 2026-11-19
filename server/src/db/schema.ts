import { pgTable, integer, text, date, boolean, numeric, timestamp, varchar, json, uniqueIndex, index, primaryKey, check, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const authors = pgTable(
  'authors',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    syncId: uuid('sync_id').notNull().defaultRandom().unique(),
    firstName: text('first_name').notNull().default(''),
    middleName: text('middle_name').notNull().default(''),
    lastName: text('last_name').notNull(),
    country: text('country'),
    gender: text('gender'), // Female | Male | Non-binary
  },
  (t) => [
    uniqueIndex('authors_name_unique').on(sql`lower(${t.firstName})`, sql`lower(${t.middleName})`, sql`lower(${t.lastName})`),
    check('authors_last_name_nonblank', sql`${t.lastName} ~ '[^[:space:]]'`),
    check('authors_gender_allowed', sql`${t.gender} IN ('Female', 'Male', 'Non-binary')`),
  ],
);

export const countries = pgTable('countries', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  syncId: uuid('sync_id').notNull().defaultRandom().unique(),
  name: text('name').notNull(),
}, t => [uniqueIndex('countries_name_unique').on(sql`lower(${t.name})`), check('countries_name_nonblank', sql`${t.name} ~ '[^[:space:]]'`)]);
export const authorCountries = pgTable('author_countries', {
  authorId: integer('author_id').notNull().references(() => authors.id, { onDelete: 'cascade' }),
  countryId: integer('country_id').notNull().references(() => countries.id),
}, t => [primaryKey({ columns: [t.authorId, t.countryId] }), index('author_countries_country_idx').on(t.countryId)]);

export const genres = pgTable(
  'genres',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    syncId: uuid('sync_id').notNull().defaultRandom().unique(),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('genres_name_unique').on(sql`lower(${t.name})`),
    check('genres_name_nonblank', sql`${t.name} ~ '[^[:space:]]'`)],
);

export const tags = pgTable(
  'tags',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    syncId: uuid('sync_id').notNull().defaultRandom().unique(),
    createdByUserId: integer('created_by_user_id').notNull().references(() => users.id),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('tags_name_unique').on(sql`lower(${t.name})`),
    check('tags_name_nonblank', sql`${t.name} ~ '[^[:space:]]'`)],
);

export const books = pgTable(
  'books',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    syncId: uuid('sync_id').notNull().defaultRandom().unique(),
    title: text('title').notNull(),
    authorId: integer('author_id').notNull().references(() => authors.id),
    coAuthors: text('co_authors'), // display only, e.g. "Jane Doe, John Roe"
    genreId: integer('genre_id').notNull().references(() => genres.id),
    category: text('category').notNull(), // Fiction | Non-fiction
    pageCount: integer('page_count').notNull(),
  },
  (t) => [
    uniqueIndex('books_title_author_unique').on(sql`lower(${t.title})`, t.authorId),
    index('books_author_idx').on(t.authorId),
    index('books_genre_idx').on(t.genreId),
    check('books_title_nonblank', sql`${t.title} ~ '[^[:space:]]'`),
    check('books_page_count_positive', sql`${t.pageCount} > 0`),
    check('books_category_allowed', sql`${t.category} IN ('Fiction', 'Non-fiction')`),
  ],
);

export const bookTags = pgTable(
  'book_tags',
  {
    userId: integer('user_id').notNull().references(() => users.id),
    bookId: integer('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.bookId, t.tagId] }),
    index('book_tags_tag_idx').on(t.tagId),
    index('book_tags_book_idx').on(t.bookId),
  ],
);


export const readings = pgTable(
  'readings',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    syncId: uuid('sync_id').notNull().defaultRandom().unique(),
    userId: integer('user_id').notNull().references(() => users.id),
    bookId: integer('book_id').notNull().references(() => books.id),
    startedOn: date('started_on').notNull(),
    finishedOn: date('finished_on'),
    // Marks readings whose recorded dates are uncertain.
    dateUncertain: boolean('date_uncertain').notNull().default(false),
    abandoned: boolean('abandoned').notNull().default(false),
    format: text('format').notNull(), // Print | Kindle | Audiobook | Graphic Novel
    rating: numeric('rating', { precision: 3, scale: 1, mode: 'number' }),
    review: text('review'),
  },
  (t) => [
    check('readings_format_allowed', sql`${t.format} IN ('Print', 'Kindle', 'Audiobook', 'Graphic Novel')`),
    index('readings_book_idx').on(t.bookId),
    index('readings_user_idx').on(t.userId),
    index('readings_finished_on_idx').on(t.finishedOn),
    check('readings_abandoned_no_finish', sql`NOT (${t.abandoned} AND ${t.finishedOn} IS NOT NULL)`),
    check('readings_finish_after_start', sql`${t.finishedOn} IS NULL OR ${t.finishedOn} >= ${t.startedOn}`),
    check('readings_rating_range', sql`${t.rating} BETWEEN 0.5 AND 10 AND (${t.rating} * 2) % 1 = 0`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    libraryId: uuid('library_id').notNull().defaultRandom().unique(),
    email: text('email').notNull(),
    role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(sql`lower(${t.email})`),
    check('users_role_allowed', sql`${t.role} IN ('admin', 'user')`)],
);

// Written atomically with a one-time import; no receipt exists for a failed batch.
export const importReceipts = pgTable(
  'import_receipts',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    batchKey: text('batch_key').notNull(),
    userId: integer('user_id').notNull().references(() => users.id),
    csvSha256: text('csv_sha256').notNull(),
    mappingSha256: text('mapping_sha256').notNull(),
    insertedIds: json('inserted_ids').$type<{ authors: number[]; books: number[]; readings: number[] }>().notNull(),
    insertedSha256: text('inserted_sha256').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('import_receipts_batch_user_unique').on(t.batchKey, t.userId)],
);

// Shape required by connect-pg-simple, defined here so migrations own it.
export const sessions = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6 }).notNull(),
  },
  (t) => [index('session_expire_idx').on(t.expire)],
);

// Internal transfer foundation; never exposed as ordinary API records.
export const transferDevice = pgTable('transfer_device', {
  singleton: boolean('singleton').primaryKey().default(true),
  deviceId: uuid('device_id').notNull().defaultRandom().unique(),
}, t => [check('transfer_device_singleton', sql`${t.singleton} = true`)]);
export const transferStates = pgTable('transfer_states', {
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  libraryId: uuid('library_id'),
  revision: uuid('revision').notNull().defaultRandom(),
  state: json('state').$type<Record<string, unknown>>(),
}, t => [primaryKey({ columns: [t.entityType, t.entityId] })]);
export const transferChanges = pgTable('transfer_changes', {
  changeId: uuid('change_id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  libraryId: uuid('library_id'),
  originDeviceId: uuid('origin_device_id').notNull(),
  previousRevision: uuid('previous_revision'),
  revision: uuid('revision').notNull(),
  beforeState: json('before_state').$type<Record<string, unknown>>(),
  afterState: json('after_state').$type<Record<string, unknown>>(),
});

// Export manifests describe sent revisions; they are never delivery acknowledgments.
export const transferExports = pgTable('transfer_exports', {
  transferId: uuid('transfer_id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  destinationDeviceId: uuid('destination_device_id'),
  payloadSha256: text('payload_sha256').notNull(),
  manifest: json('manifest').$type<{ entityType: string; entityId: string; revision: string }[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Receipts and per-change outcomes are committed with domain writes. Retain the
// original proposal even when a conflict produces a new laptop revision.
export const transferImports = pgTable('transfer_imports', {
  transferId: uuid('transfer_id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  requestSha256: text('request_sha256').notNull(),
  result: json('result').$type<Record<string, unknown>>().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
});
export const transferImportChanges = pgTable('transfer_import_changes', {
  changeId: uuid('change_id').primaryKey(),
  transferId: uuid('transfer_id').notNull().references(() => transferImports.transferId),
  userId: integer('user_id').notNull().references(() => users.id),
  originDeviceId: uuid('origin_device_id').notNull(),
  proposalSha256: text('proposal_sha256').notNull(),
  proposal: json('proposal').$type<Record<string, unknown>>().notNull(),
  outcome: json('outcome').$type<Record<string, unknown>>().notNull(),
});

// Device-local identities resolve to canonical laptop catalog identities.
export const transferAliases = pgTable('transfer_aliases', {
  userId: integer('user_id').notNull().references(() => users.id),
  sourceDeviceId: uuid('source_device_id').notNull(),
  entityType: text('entity_type').notNull(),
  incomingId: uuid('incoming_id').notNull(),
  localId: uuid('local_id').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.sourceDeviceId, t.entityType, t.incomingId] })]);

// Immutable full refresh for a completed phone import.
export const transferRefreshes = pgTable('transfer_refreshes', {
  importId: uuid('import_id').primaryKey().references(() => transferImports.transferId),
  userId: integer('user_id').notNull().references(() => users.id),
  payload: json('payload').$type<Record<string, unknown>>().notNull(),
});
