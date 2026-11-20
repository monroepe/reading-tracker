# Client

The web app uses React, React Router, and TanStack Query. The Android companion
and browser demo reuse feature screens with their own data providers.
For web setup and project-wide checks, see the [README](../README.md).

## Code map

- `client/src/App.tsx` defines the web routes and access guards.
- `client/src/features/` contains feature screens, forms, and query hooks.
- `client/src/api/` contains the HTTP client and API types.
- `client/src/data/` contains the shared data interfaces and library queries.
- `client/src/companion/` and `client/src/demo/` provide the other app entry points.

Vite proxies web requests under `/api` to the local server on port 3000.
See the [server guide](server.md) for the API and the [Android guide](android.md)
for the phone transfer workflow.

## Demo

The demo runs in the browser with bundled sample data. No API, database, or
account is required. Add Book and Log Reading let visitors preview the forms
without saving changes to the sample library.

The sample catalog includes [The Guardian’s 100 best novels of all time](https://www.theguardian.com/books/ng-interactive/2026/may/12/the-100-best-novels-of-all-time)
and 25 nonfiction titles, with fictional reading activity.

### Preview locally

With Node 24 and both client and server dependencies installed, run from the
repository root. The build type-checks client code that imports server schemas
and integration tests that import server code.

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
build job installs both sets of dependencies, builds the demo, and uploads only
`client/dist-demo/`. The deploy job publishes that artifact. If the build
succeeded and deployment failed, rerun the deploy job while the artifact is
still available. If the artifact is missing or expired, start a fresh workflow run.
