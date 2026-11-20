# Reading Tracker

Reading Tracker is a web app for logging books and rereads, organizing a personal
library with tags, and exploring reading habits through charts and a Year in
Review. An offline Android companion lets you log and edit readings away from
your computer.

[Try the live demo](https://monroepe.github.io/reading-tracker/) to browse a
sample library and explore reading stats in your browser, no account required.

## How it works

The React web app stores your library in PostgreSQL through an Express API.
The Android companion shares the React interface and stores its library in
SQLite. You can move your library and reading updates between devices with JSON
transfer files.

## Run locally

You’ll need Node.js 24, npm, and PostgreSQL. From the repository root, install
dependencies and copy the example server configuration.

```sh
npm ci
npm ci --prefix client
npm ci --prefix server
cp server/.env.example server/.env
```

Set a `SESSION_SECRET` of at least 32 characters in `server/.env`, then follow
[Initialize a new database](docs/server.md#initialize-a-new-database) to configure
PostgreSQL, apply the schema, and create your account. Start the app from the
repository root.

```sh
npm run dev
```

Open the local URL printed by Vite and sign in with the account you created.
For native builds and phone setup, see the [Android guide](docs/android.md).

## Verify

```sh
npm run check
```

This runs client lint, client and server unit tests, and builds the web app,
companion web bundle, and server. The [database integration tests](docs/server.md#tests)
run separately against a disposable PostgreSQL database and include a
PostgreSQL–SQLite transfer round trip.

