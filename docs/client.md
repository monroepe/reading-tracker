# Client

The desktop and mobile website share a React/TypeScript application. The Android
companion reuses its UI with a separate entry point and local data layer; see
[Android](android.md). Read [server setup](server.md) for the API and database.
All commands below run from the repository root.

## Setup and checks

Use Node 24 and npm. Install root, client, and server dependencies:

```sh
npm ci
npm ci --prefix client
npm ci --prefix server
```

After server configuration, the user runs `npm run dev` to start both processes.
Vite proxies `/api` to `http://localhost:3000`; no client secrets are required.

```sh
npm test --prefix client
npm run lint --prefix client
npm run build --prefix client
```

Tests use Vitest, jsdom, and Testing Library. The production web build is
`client/dist/`. It does not update Android assets or create an APK.
Run `npm run check` from the root to lint the client, test the client and server,
and build web, companion, and server. Root `npm test` runs server tests only.
The [database integration checks](server.md#tests) require a disposable database.

## Code map and conventions

- `client/src/main.tsx`: router, QueryClient, and web entry point.
- `client/src/App.tsx`: routes, authentication, and persistent layout.
- `client/src/features/`: pages, components, API calls, and query hooks. Books
  separates `api`, `components`, `hooks`, `pages`, and `utils`; follow the surrounding feature.
- `client/src/components/`: shared components; `ui/` contains UI primitives.
- `client/src/api/`: fetch wrapper, API types, and query-string helpers.
- `client/src/hooks/` and `client/src/lib/`: shared state and utilities.
- `client/src/companion/`: Android entry point and offline implementation.

Imports may use `@/` for `client/src`. The UI uses Tailwind CSS, shadcn/Base UI,
Lucide icons, TanStack Table, and Recharts. Feature hooks use TanStack Query and
the shared `api()` wrapper. Preserve mutation invalidations and user isolation;
authentication changes must not expose the previous account's cached data.

Authors select zero or more countries from a shared catalog. Books reference a primary author and genre; co-authors are display text. Readings
are separate personal records, so a book can have multiple readings. Tag names
are shared, while book-tag selections belong to the signed-in user. Admin controls
manage the shared catalog; preserve server permission checks.

## Navigation and forms

Use the existing `FormLink`, `FormCancelLink`, and `useFormReturn` pattern.
`FormLink` records the origin in router state and carries a safe `returnTo` URL.
Cancel and applicable successful saves return through history when the recorded
origin matches; direct-entry forms replace the route with a safe destination.
This prevents list → detail → edit → Cancel → Back from reopening the edit form.
Preserve nested create/select flows and their `selectCreated` behavior.

`MobilePageNavigation` shares the form return logic on mobile web and Android.
Form cancellation clears its draft. Keep draft retention, list filters, and
`ScrollReturnProvider`/return-scroll behavior intact when changing navigation.
Relevant regression tests are beside these components.

## Loading and responsive behavior

Secondary pages use module-level React `lazy` imports directly from page modules.
Readings and web Login remain eager. `PageBoundary` wraps the route outlet with
loading/error recovery while the header and navigation remain mounted. Preserve
provider placement and avoid barrel imports that eagerly include deferred pages.

Both QueryClients default to `staleTime: 30_000`, with retries and window-focus
refetching disabled. Freshness is not polling or cache eviction. Keep per-query
settings, mutation invalidations, and native resume/import resets.

`useIsDesktop` observes the Tailwind `md` breakpoint, `(min-width: 48rem)`.
Readings, Books, and Authors lazy-load only the selected desktop or mobile view.
Queries, committed filters, sorting, and selections stay in parent pages; crossing
the breakpoint discards view-local expanded rows and popovers. Local Suspense
keeps headings/navigation visible while a view loads; scroll restoration waits
for that view and its data. Tests cover all three pages switching mobile → desktop
→ mobile with filters, sorting, and scroll readiness. Preserve this on mobile web,
Android rotation, and tablets. Reading Mix has automated coverage for chart container resizing. Browser and
device layout checks still cover viewport behavior.
Readings per year hides Pre-2022 by default. The **Include Pre-2022** checkbox
is available to web admins and on Android when its Pre-2022 controls are enabled.
Inter fonts are bundled locally with Latin and Latin Extended subsets.

Analytics sections own their filters, queries, and derived chart data. Changing a
section filter does not rerender unrelated sections; regression tests use controlled
query results to verify this isolation. Charts still mount normally and retain
animations. Reading Mix can retry failed year queries while keeping the selected
filters and successful query results.

Use `node client/scripts/measure-startup.mjs` after building the web and
companion bundles to measure their static JavaScript imports.

## Phone import review

On laptops, Transfers accepts a single phone JSON file dragged into its drop area.
The file-selection button remains available on all devices. Both methods validate the JSON before navigating to
`/transfers/review`. The review groups changes by book, distinguishes possible
duplicates from new books, and shows tag additions/removals and separate readings.
Author, country, genre, and tag proposals are shown separately. Saving is enabled
only after required decisions are resolved. Success offers the confirmed phone refresh.

The transfer session provider sits outside the keyed `PageBoundary`, so navigation
from file selection to review preserves the in-memory file. It resets when leaving
Transfers; Cancel or returning to the picker clears it. Reload requires selecting
the phone file again. After an uncertain commit response, identical-request retry
recovers the result; edits and Cancel are disabled until the outcome is known.

Books and Authors default to 25 records per page. Desktop offers 25/50/100,
result totals, and direct page selection. Mobile keeps 25 with compact Previous/Next
and page selection in one row, without the result range. Page state stays in the URL; filters and sorting reset
it to page 1. Readings remains unchanged.

Desktop Books shows tags in place of the co-authors column: two alphabetical
badges and a +N popover for additional tags. Co-authors appear beneath the author.
Mobile presentation is unchanged. Book list data includes the user's tags on web
and in companion storage.

Mobile Readings and Books offer **Rating: High to low** and **Rating: Low to high**
in Filters & sort. Unrated items appear last in either direction. Books use the
latest finished reading’s rating; Readings use each reading’s own rating.

Book detail shows Days and Pages/day for each completed reading, and elapsed days
for ongoing readings. Duration is finish minus start (same-day = 0); pace uses the
current page count and appears only for positive completed durations. Uncertain
and abandoned readings omit these statistics. Android refreshes book queries on resume.

## Countries and genres

Web admins and the offline Android library can add and rename countries/genres
through Admin. Android's hamburger offers Admin and Transfers & settings. Author
forms offer explicit country creation and a searchable multipicker with removable country chips; book forms require
an existing genre or explicit creation before saving. Names are trimmed and unique
ignoring case. Creation retains the current form; cancelling the author/book does
not remove a catalog value already created. Deletion and merging are excluded.

Author writes use `countryIds`; PATCH omission preserves associations and `[]`
clears them. Responses include `countries` objects and a derived `country` display
string. Country filters match any association; sorting uses the alphabetically first
country. Country statistics count each completed reading once per associated country,
so country totals may exceed total readings. Book counts do not multiply with countries.
Country lists come from the catalog, rather than loading all authors for suggestions.

Book details support direct personal tag edits in Android, even without readings.
Admin routes remain lazy-loaded, and new local writes rebuild the projection once.

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
and top-five genres plus Other, with Percentage/Count views. Year dropdowns and
Reading mix use periods with completed readings. On web, admins can select
Pre-2022 and change graphic novel inclusion in rankings. Regular accounts see
all formats in rankings.
The shared chart reuses existing per-year analytics queries and offline methods.

## Portfolio demo

The demo uses shared React screens and bundled sample JSON. It runs in the
browser without an API, database, or sign-in. It includes Log, Books, Authors,
Analytics, and Year in Review, plus Add Book and Log Reading form previews that
leave the sample library unchanged.

The fixture has 125 books, 130 completed readings (78 Print, 39 Kindle, and 13
Audiobook), and one Kindle reading in progress. Dates roll forward with the
calendar across the current year and the previous three years. The compact
Authors list supports name search and sorting. Expanding a book count shows book
titles and their latest reading ratings. Demo Analytics omits Reading mix over
time and links to Year in Review.

### Preview locally

With Node 24 and the client dependencies installed, run from the repository root:

```sh
npm run build:demo --prefix client
npm run preview:demo --prefix client
```

The preview serves the files in `client/dist-demo/`. After changing source files,
rerun the build command and refresh the browser.

### Publish on GitHub Pages

1. Push the project to a GitHub repository.
2. On the repository, select **Settings → Pages → Build and deployment →
   Source → GitHub Actions**. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)
3. In **Actions**, run **Publish portfolio demo** on the default branch. Once
   the deploy job succeeds, open the URL it reports. Check the Log, Authors,
   and Year in Review, including reloading a page with a hash route such as
   `#/authors`.

Subsequent default-branch pushes publish automatically through
[`.github/workflows/demo-pages.yml`](../.github/workflows/demo-pages.yml). The
workflow installs client dependencies, builds the demo, and uploads only
`client/dist-demo/`.
