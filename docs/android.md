# Android companion

The offline Android app shares React UI with the [web client](client.md), using
Capacitor and native SQLite instead of the [server](server.md). It supports Log,
Books, Authors, Analytics, and Year in Review, including author/book creation,
reading entry/corrections, and tags. Countries and genres can be created and renamed in Admin or explicitly created
while entering an author/book. Authors support multiple countries. Deletion, login,
and global tag administration remain unavailable in the companion.

## Setup and code map

Use Node 24 (real-SQLite tests require Node 22.13+), Android Studio Otter 2025.2.1
or newer, SDK platform/build tools for SDK 36, and JDK 21. Install client
dependencies with `npm ci --prefix client`. Set `JAVA_HOME` and `ANDROID_HOME`,
or configure the SDK path in ignored `client/android/local.properties`.

- `client/src/companion/main.tsx`: native entry point and QueryClient.
- `client/src/companion/Settings.tsx`: deferred setup and transfer interface.
- `client/src/companion/CompanionApp.tsx`: routes, initialization, editing locks,
  and native Back/resume behavior.
- `client/src/companion/storage/`: SQLite schema, reads/writes, snapshots,
  frozen outbound exchange, and refresh replacement. Browser-independent library
  queries and analytics are shared with the portfolio demo in `client/src/data/`.
- `client/src/companion/AnalyticsPage.tsx`: Android chart selections and local data;
  do not substitute the web Analytics page.
- `client/vite.companion.config.ts`: separate build into `dist-companion`, with
  a boundary rejecting server runtime imports except explicitly allowed pure schemas.
- `client/capacitor.config.ts`: package ID and bundled asset directory.
- `client/android/app/build.gradle`: Android versions and versioned APK task.

The package ID is `com.petermonroe.readingtracker.companion`, app name
**Reading Tracker**. Bundle all required assets locally. There is no browser SQLite
fallback; native storage must be tested in the APK. Automated storage tests use a
real SQLite adapter. Preserve the no-network boundary, device/library identities,
local transaction guarantees, resume invalidation, and pending-export editing lock.
Shared navigation and responsive behavior are covered in the client guide.

Analytics includes offline category (doughnut), genre (bar), and tag (bar)
breakdowns, each with an independent finish-year filter. Tags use current book
assignments; a reading can count toward multiple tags. Readings per year hides
Pre-2022 by default; use **Include Pre-2022** to restore that bar.
Analytics bar charts use blue for years, purple for genres, and green for tags;
format and category doughnuts use multiple colors.

## Library loading and performance

Storage hydrates the in-memory library once when opened; repeated read access
reuses that projection. Completed imports/refreshes explicitly reload it. Saves
construct their return values with focused reads inside the transaction, then
rebuild the shared projection once after commit before query invalidation.
A failed post-commit reload does not reject the committed save; subsequent reads
show recovery guidance until reload or restart succeeds. Relationship maps/grouped
lookups preserve separate latest-finished-book and latest-started-history rules.
Book updates now return the latest finished reading even outside the first list
page, rather than falling back to a null last reading.

Android Analytics sections own independent filters and queries. Each additional
breakdown subscribes only to its displayed category, genre, or tag query.

Settings loads on demand, including during initial setup with loading/error
recovery. Storage loads bootstrap, export, and refresh operations on demand within
the existing serialized queue. Save validation remains eager. Transfer validation,
transactions, frozen exports, editing locks, and reloads are preserved. Shared
[list layout loading](client.md#loading-and-responsive-behavior) also applies here.
Tests cover initial Settings, transfer failure recovery, and layout changes.

## Version and build

The Android version name and version code are configured in `client/android/app/build.gradle`.

Every new APK build requires a new version: increment `versionName` and use a
strictly higher `versionCode` in `client/android/app/build.gradle` before building.
This applies even to small UI/text changes and rebuilds. Never reuse a previous
build's version name or version code.
Update this guide's delivery version when a new APK is successfully built.
A web production build alone does not produce or update an APK.

Set `JAVA_HOME` to your JDK installation and `ANDROID_HOME` to your Android SDK
installation. Then run this from the repository root:

```sh
npm run android:build --prefix client
```

This runs the TypeScript/companion build, Capacitor plugin/asset sync, and Gradle
`versionedDebugApk`. The installable file is:

```text
client/android/app/build/outputs/apk/versioned/reading-tracker-<versionName>-debug.apk
```

Report the version and actual APK path after a successful build. Alternatively,
`npm run android:sync --prefix client` prepares the native project to build in
Android Studio; sync alone does not compile an APK.

The user installs and manually tests the APK. Install updates over the existing
app with the same package/signing key to preserve data. Current builds use the
local Android debug key. Release signing and private key backup remain follow-up
work; changing or losing the key can require uninstalling. Do not commit APKs,
keys, local SDK paths, or personal transfer files.

System navigation icons explicitly use dark content against the light app background.
Settings uses **Choose laptop file** with setup/refresh guidance before review.

## Initialize a phone

1. The user starts the laptop app/server and signs in.
2. In the account menu open **Transfers** (`/transfers`) and download a snapshot.
   Omit `destinationDeviceId` for initial setup, or use the phone's displayed ID.
3. Copy the JSON to the phone, open the companion, choose the file, review counts,
   and import. Settings shows library/device identities.

Only version-2 snapshots up to 10 MiB are accepted. Initialization is atomic and
one-time, even for an empty library. Repeating the identical file reports already
imported; another ordinary snapshot cannot replace an initialized library.
Uninstalling or clearing storage removes phone data. Automatic Android cloud backup
and device transfer are excluded so another install cannot inherit this device ID.
Keep the original laptop library and initial snapshot.

## Transfer phone and laptop changes

1. Finish/cancel open phone forms. In Settings choose **Export for laptop**, then
   **Export and pause editing**. Save/send the JSON to the laptop with Android sharing.
2. In laptop **Transfers**, choose the phone file. A dedicated review page groups
   book details, tag selections, and readings by book, with author/tag changes
   shown separately. Resolve matches/conflicts, then choose **Import changes**.
   **Cancel** discards only the review; the phone remains paused.
   **Skip this book** discards its phone edits, tags, and readings when the return
   refresh replaces the phone library. Unused new authors/tags belonging only to
   skipped books are also discarded. Matching an existing book keeps laptop
   details and applies incoming readings and the complete reviewed tag selection,
   including removals.
3. Choose **Download phone refresh**. If lost, select the same phone file again
   to retrieve the saved refresh.
4. Copy that refresh to the phone, select it in Settings, review counts, and choose
   **Replace phone library**. Editing resumes.

Browsing remains available while editing is paused, including after cancelled
sharing or restart. **Share export again** retrieves the same durable frozen file.
There is no discard-and-unlock shortcut; retain that file until the round trip ends.

Wrong/stale refreshes are rejected. A failed replacement preserves the library and
pending export. Laptop conflict choices are final for that round; subsequent laptop
changes arrive next round. Export from the phone even with no pending changes to
receive laptop-only changes. Ordinary snapshots are only for initial setup.

Transfer files are plaintext personal data: keep them outside the repository.
Full phone backup/restore, automatic sync, incremental return merging, and history
compaction are deferred. Migration `0012_phone_refresh` is already applied to the
existing laptop database; do not repeat migration/import work as phone setup.

## Verification and remaining checks

```sh
npm test --prefix client
npm run lint --prefix client
npm run build:companion --prefix client
```

The root `npm run check` includes the companion bundle and client tests. The
PostgreSQL/SQLite round-trip test requires a disposable `TEST_DATABASE_URL`.
See [server tests](server.md#tests) for the database requirements and commands.
APK compilation is a separate build check.
Manual checks for an Android release:

- Repeated phone → laptop → phone transfers, conflict choices, and laptop-only changes.
- Cancel sharing, restart, re-share the frozen export, and reject wrong/repeated refreshes.
- Airplane-mode cold launch, force-stop/restart persistence, and an update preserving
  library/device identity.
- Nested Back/Cancel, including detail → edit → Cancel → Back returning to the
  originating list; scroll/draft retention; rotation and tablet layouts.

Further automated coverage is needed for nested mobile history and
additional transfer review/failure branches. Reading Mix has an automated
container resize check and supports retrying failed year queries.

Books and Authors default to 25 records per page. Desktop offers 25/50/100,
result totals, and direct page selection. Mobile keeps 25 with compact Previous/Next
and page selection in one row, without the result range. Page state stays in the URL; filters and sorting reset
it to page 1. Readings remains unchanged.
Latest-finished readings are selected in one pass per book during library
hydration; displayed history retains its start-date ordering.

Mobile Readings and Books offer **Rating: High to low** and **Rating: Low to high**
in Filters & sort. Unrated items appear last in either direction. Books use the
latest finished reading’s rating; Readings use each reading’s own rating.

Book detail shows Days and Pages/day for each completed reading, and elapsed days
for ongoing readings. Duration is finish minus start (same-day = 0); pace uses the
current page count and appears only for positive completed durations. Uncertain
and abandoned readings omit these statistics. Android refreshes book queries on resume.

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

Analytics includes Reading mix over time: yearly stacked bars for format, category,
and top-five genres plus Other, with Percentage/Count views and optional Pre-2022.
The shared chart reuses existing per-year analytics queries and offline methods.

Analytics filters and Reading Mix use completed reading years. **Transfers & settings** has separate switches for Pre-2022 controls
and graphic novel ranking controls. Both switches are on by default. Turning off the
graphic novel controls includes all formats in rankings. Preferences stay on the
device across library refreshes.
