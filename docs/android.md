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

The companion entry point and native storage live in `client/src/companion/`.
The build bundles the React app and runs it with native SQLite on Android.

## Version and build

The Android version name and version code are configured in `client/android/app/build.gradle`.

For APK updates, use a higher `versionCode` and a new `versionName`.

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

To prepare the native project for Android Studio, run
`npm run android:sync --prefix client`. To update an installed app and preserve
its data, use the same application ID and signing key. The script produces a
debug-signed APK.

## Initialize a phone

1. Start the web app and sign in.
2. Open **Transfers** from the account menu and select **Download snapshot**.
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
   **Skip this book and discard its phone changes** discards its edits, tags, and readings when the return
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

Keep transfer files private. They contain a copy of your reading data.

## Verify

Run `npm run check` for the companion web build and automated tests. See
[server tests](server.md#tests) for the PostgreSQL–SQLite round trip. On a device,
check offline launch, data persistence after restart, and a full transfer round trip
before distributing an APK.
