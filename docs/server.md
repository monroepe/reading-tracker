# Server

The Express API validates requests with Zod and uses Drizzle with PostgreSQL.

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

Follow [Initialize a new database](#initialize-a-new-database) before starting
the server for the first time. The [README](../README.md) covers running both apps.

## Initialize a new database

Create an empty PostgreSQL database and set `DATABASE_URL` in `server/.env` to
point to it. Apply the schema and create an administrator account. The account
command prompts for a password.

```sh
npm run db:migrate --prefix server
npm run create-user --prefix server -- reader@example.com --admin
```

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

## Upgrade an existing database

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

4. Run the transactional migration runner:

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

The authenticated web app uses these endpoints under `/api/transfers`.

| Endpoint | Purpose |
| --- | --- |
| `POST /exports` | Download an initial phone snapshot. |
| `POST /imports/preview` | Validate the phone exchange and preview matches and conflicts without writing. |
| `POST /imports/commit` | Apply the reviewed decisions and save the receipt in one transaction. |
| `POST /refreshes` | Download the saved phone refresh by import ID. |

A stale preview returns HTTP 409. Preview again before committing. If the commit
response is lost, retry the identical request to retrieve its saved result. The
refresh is addressed to the originating phone and can be downloaded again.
Snapshots and refreshes contain shared catalog data and the signed-in owner's
readings and tag selections. See the [Android guide](android.md#transfer-phone-and-laptop-changes)
for the steps in the app.

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
