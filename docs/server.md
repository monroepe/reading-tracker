# Server

Node.js/Express API using TypeScript, Zod, PostgreSQL, and Drizzle ORM.
Read [client](client.md) for the web UI and [Android](android.md) for phone operation.
All commands below run from the repository root.

## Setup

Use Node 24, npm, and PostgreSQL. Install dependencies as described in the client
guide. Create a local `server/.env` with these values, using your own credentials:

```dotenv
DATABASE_URL=postgresql://localhost/reading_tracker
SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters-long
NODE_ENV=development
PORT=3000
```

Do not commit `.env` or real credentials. Development scripts load `server/.env`.
Production must supply environment variables itself. `PORT` defaults to 3000.
The user runs `npm run dev` from the root, or `npm run dev --prefix server`.
`npm run build --prefix server` compiles into `server/dist/`;
`npm start --prefix server` starts that compiled API.

For a new empty database, apply migrations through the workflow below, then create
an account (the command prompts for a password of at least 12 characters):

```sh
npm run create-user --prefix server -- your-account@example.com --admin
```

Omit `--admin` for a regular user. To promote an existing account:

```sh
npm run promote-user --prefix server -- existing-account@example.com
```

Role management is CLI-only. Refresh or sign in again after role changes.

## Code map and request flow

- `server/src/index.ts`: starts the listener.
- `server/src/app.ts`: app factory, middleware, and API routers.
- `server/src/<feature>/`: routes validate with Zod, then delegate to services.
- `server/src/middleware/`: authentication, sessions, and error handling.
- `server/src/db/schema.ts`: Drizzle schema; `server/drizzle/` stores migrations.
- `server/src/scripts/`: migration and account/import commands.
- `server/src/transfers/`: contracts, preview planning, commit, export, and refresh.

Use `.js` extensions in relative TypeScript imports. API routes require a session
except health and authentication endpoints. Passwords use Argon2; sessions use
`express-session` and the PostgreSQL `session` table. The `rt.sid` cookie is
HTTP-only, SameSite Lax, and secure in production; production trusts one proxy hop.
The health endpoint checks database connectivity.

Authors, genres, books, and tag names are shared catalog data. Readings and
book-tag assignments are user-scoped. Preserve ownership checks, admin permissions,
validation, and transaction boundaries. Uncertain historical reading dates are
intentional; do not invent dates or change that metadata through phone transfers.

## Database changes

Codex must receive fresh permission for **each real-database migration run**.
Do not treat setup instructions or an earlier approval as permission to execute it.
The existing local library has migrations through `0013_known_supreme_intelligence` applied;
completed migrations and imports are not setup work to repeat.

1. Stop the app/server and other database writers.
2. Back up the exact database configured in `server/.env`, outside the repository.
   For example, with your own database and backup path:

   ```sh
   pg_dump --dbname=reading_tracker --format=custom --file=/absolute/backup/path/reading-tracker.dump
   pg_restore --list /absolute/backup/path/reading-tracker.dump
   ```

3. Run the read-only preflight and correct any reported violations deliberately:

   ```sh
   npm run db:migrate --prefix server -- --check
   ```

4. After permission, run the transactional migration runner:

   ```sh
   npm run db:migrate --prefix server
   ```

5. Compare before/after record counts before restarting the matching application.
   On failure keep writers stopped. A committed count mismatch requires investigation
   and potentially restoring the backup with the matching previous app version.

Generate SQL for schema changes with `npm run db:generate --prefix server` and
review it. Use the runner rather than `drizzle-kit push` or standalone migration SQL.
The legacy personal-tags transition alone needs `--owner-email <existing-email>`
on preflight and migration when existing tags/assignments lack ownership. It
preserves readings and catalog records, assigns legacy selections to that account,
and promotes it to admin. Later migrations do not require the owner option.

## Phone transfers

The authenticated `/transfers` screen uses these endpoints under `/api/transfers`:

| Endpoint | Purpose |
| --- | --- |
| `POST /exports` | `{ kind: "snapshot", destinationDeviceId?: UUID }`: initial phone snapshot; omit destination for initialization. |
| `POST /imports/preview` | Validate a changes envelope and optional catalog matches without writing. |
| `POST /imports/commit` | Commit the reviewed exchange, matches, preview digest, and conflict choices atomically. |
| `POST /refreshes` | `{ importId: UUID }`: retrieve a durable full refresh for a completed phone import. |

`transfer-contract.ts` is the source of truth for runtime schemas and types.
Version-2 files use `format: "reading-tracker"`, device/library UUIDs, and stable
entity/revision identities. Snapshot records carry `entityType`, `entityId`,
`revision`, and `data`; null data is a tombstone. Revisions express identity and
ancestry, not chronological order. Files are limited to 10 MiB; exchanges allow
up to 10,000 proposals. Downloads are private JSON attachments with no-store caching.
Exports include the shared catalog and only the current owner's readings and tag
selections; credentials, sessions, and other users' private records are excluded.

Preview checks library/device scope, baselines, references, and immutable revision
content. New authors/books require explicit matching or confirmation of creation.
Unique case-insensitive tag matches resolve automatically. Saved aliases are scoped
to the user and sending device. Conflicts require whole-record `local` or `incoming`
choices; restoring a laptop deletion requires explicit `restore`. Blocked proposals
and unresolved references prevent commit. Companion deletion and uncertain-date changes remain blocked. Country/genre creation and renaming require admin permission. Inspect contracts/planner code before
extending this policy.

Preview and commit accept optional `skippedBookIds: UUID[]` containing original
book identities in the phone file. The server expands these to all proposals
resolving to those books, including readings/tag selections, plus new authors/tags
used exclusively by discarded books. Shared dependencies remain included.
Selections participate in the preview digest and request identity. Discarded
proposals receive `action: "discarded"` receipt outcomes without domain writes or
new aliases. The original full exchange remains in the receipt and confirmed
refresh, so replacing the phone library removes those discarded changes.
No database migration or phone update is needed. Preview responses include
`discardedChangeIds` and `localReferences` for presentation.

Commit replans under table locks (five-second lock timeout). A stale digest returns
409; errors roll back records, aliases, and receipts together. Identical retries
return saved results, while changed content under reused transfer/change identities
is rejected. Safe incoming identities/origins are retained; conflict resolutions
receive new laptop revisions. The UI supports identical-request retry after network
failure, but file contents and review decisions are lost on page reload.

Tracking uses stable UUIDs alongside unchanged numeric domain IDs. Database triggers
capture writes in `transfer_states` and `transfer_changes`; deferred tag triggers
capture final personal selections. `transfer_imports`/`transfer_import_changes` store
receipts; `transfer_aliases` stores canonical mappings. Preserve incoming origin and
revision history rather than replaying imports as unrelated local edits. Snapshot
manifests record exact revisions and a SHA-256 of the compact JSON, transactionally;
exporting a snapshot does not acknowledge phone changes. History is retained.

A confirmed refresh contains the saved exact phone exchange and a full owner-scoped
snapshot addressed to that phone. The first refresh is persisted; retries return
the same file despite later laptop edits. Legacy imports without a saved exchange
cannot produce it. The phone freezes edits until that matching refresh replaces
its library atomically; see the Android guide for the complete workflow.

## Tests

```sh
npm test
npm run build --prefix server
```

Vitest/Supertest tests are colocated as `*.test.ts`. Shared setup in
`server/src/test/setup.ts` mocks sessions and authentication; real-auth tests must
account for those mocks. Only source tests run, not compiled copies.

The root `npm run check` includes the server tests and build. Run database
integration tests separately using the commands below.

PostgreSQL integration tests are opt-in through `TEST_DATABASE_URL`. Use a separate,
empty disposable database, never the real library or `DATABASE_URL`. Tests may
migrate/create fixtures, and some create/drop generated databases and need database
creation permission. Run server integration files serially because some use the same empty database.
Run the companion round-trip test separately against the same disposable instance.
Read each suite before running it. Set `TEST_DATABASE_URL` in your shell, then run:

```sh
npm test --prefix server -- --no-file-parallelism .integration.test.ts
npm test --prefix client -- src/companion/storage/round-trip.integration.test.ts
```

## Country catalog migration and transfer version 2

Migration `0013_known_supreme_intelligence` adds
countries and author_countries, backfills trimmed case-insensitive country names,
and validates preservation of existing nonblank associations. The old authors.country
column remains historical data; current APIs and analytics use the association table.
There is no automatic synonym merging. Association indexes support both directions.

Author changes track the final sorted country UUID set at transaction end. Country
renames do not revise authors. Existing transfer journal entries and receipts stay
unchanged; historical version-1 author states retain their original projection.
The new author shape receives a new revision. New exports/imports use version 2;
old phone changes must be completed before upgrading and are rejected afterward.

Countries support GET/POST `/api/countries` and PATCH `/api/countries/:id`; writes
require admin. Author writes accept `countryIds` numeric IDs, not country text.
Genre listing returns the complete catalog so management/pickers do not omit values.

Transfer review automatically matches exact case-insensitive country/genre names;
new unmatched entries require confirmation. Aliases remap author countries and book
genres while retaining laptop metadata for matched entries. Author conflicts select
one whole author record, never an automatic union. A colliding rename offers only
Keep laptop name; all other selected changes can still commit. New country/genre
changes remain independent when books are skipped. Existing unused new author/tag
pruning remains unchanged. All dependencies and preview digests are rechecked under
locks at commit; refreshed phone data receives canonical identities.

## CSV and export filenames

Web Transfers offers Legacy CSV and Expanded CSV for all signed-in user readings,
including rereads, ongoing and abandoned readings. Uncertain dates and their
statistics are blank. Expanded CSV adds co-authors, genre, category, author
countries/gender, personal tags, review, status, and date uncertainty. CSV downloads
are for importing into Google Sheets; they are not phone transfer files.

Exports use `reading-tracker-<purpose>-YYYY-MM-DD_HHmmss.<extension>` in
America/Chicago time. Purposes are `readings-legacy`, `readings-expanded`,
`phone-setup`, `phone-changes`, and `phone-refresh`. New JSON exports retain their
creation timestamp when shared/downloaded again. Existing files remain accepted;
old refreshes use their import receipt time and old phone changes retain a timestamp
chosen on first re-share. Install the updated companion before importing new files
with timestamp metadata. Transfer UUIDs remain inside JSON.
