/** Small driver boundary shared by the native bridge and real-SQLite tests. */
export interface SqlDatabase {
    execute(sql: string): Promise<void>;
    run(sql: string, values?: unknown[]): Promise<void>;
    query<T>(sql: string, values?: unknown[]): Promise<T[]>;
}
export async function transaction<T>(db: SqlDatabase, work: () => Promise<T>): Promise<T> {
    await db.execute('BEGIN IMMEDIATE');
    try {
        const result = await work();
        await db.execute('COMMIT');
        return result;
    }
    catch (error) {
        await db.execute('ROLLBACK');
        throw error;
    }
}
// Imported baselines stay immutable. Current records and append-only local history
// are committed alongside relational projections by the write repository.
const migration1 = `
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE baselines (
  entity_type TEXT NOT NULL, uuid TEXT NOT NULL, revision TEXT NOT NULL,
  record TEXT NOT NULL, PRIMARY KEY(entity_type, uuid)
);
CREATE TABLE authors (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE genres (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE tags (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE books (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, data TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES authors(id), genre_id INTEGER NOT NULL REFERENCES genres(id));
CREATE TABLE readings (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, data TEXT NOT NULL,
  book_id INTEGER NOT NULL REFERENCES books(id));
CREATE TABLE book_tag_sets (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE,
  book_id INTEGER NOT NULL UNIQUE REFERENCES books(id));
CREATE TABLE book_tags (selection_id INTEGER NOT NULL REFERENCES book_tag_sets(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id), PRIMARY KEY(selection_id, tag_id));
CREATE INDEX books_author ON books(author_id);
CREATE INDEX books_genre ON books(genre_id);
CREATE INDEX readings_book ON readings(book_id);
CREATE INDEX book_tags_tag ON book_tags(tag_id);
PRAGMA user_version = 1;
`;
export async function migrate(db: SqlDatabase, deviceId: string): Promise<void> {
    await db.execute('PRAGMA foreign_keys = ON');
    const [{ user_version: version }] = await db.query<{
        user_version: number;
    }>('PRAGMA user_version');
    if (version > 3)
        throw new Error('This database needs a newer app version. Your data has been preserved.');
    if (version > 0 && version < 3) {
        const initialized = await db.query<{ value: string }>("SELECT value FROM metadata WHERE key='transferId'");
        if (initialized.length) throw new Error('This update needs a fresh laptop snapshot. Complete any old transfer, then uninstall and reinstall the updated app and import a version-2 snapshot. Your existing phone data has not been changed.');
    }
    await transaction(db, async () => {
        if (version === 0)
            await db.execute(migration1);
        if (version < 2) await db.execute(`
CREATE TABLE current_records (entity_type TEXT NOT NULL, uuid TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(entity_type, uuid));
INSERT INTO current_records SELECT entity_type, uuid, record FROM baselines;
CREATE TABLE local_changes (sequence INTEGER PRIMARY KEY, change_id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL, baseline TEXT, record TEXT NOT NULL);
PRAGMA user_version = 2;
`);
        if (version < 3) await db.execute(`
CREATE TABLE countries (id INTEGER PRIMARY KEY, uuid TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE UNIQUE INDEX countries_name ON countries(lower(json_extract(data, '$.name')));
CREATE UNIQUE INDEX genres_name ON genres(lower(json_extract(data, '$.name')));
CREATE TABLE author_countries (author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE, country_id INTEGER NOT NULL REFERENCES countries(id), PRIMARY KEY(author_id,country_id));
CREATE INDEX author_countries_country ON author_countries(country_id);
PRAGMA user_version = 3;
`);
        await db.run("INSERT OR IGNORE INTO metadata(key, value) VALUES ('deviceId', ?)", [deviceId]);
    });
}
export async function metadata(db: SqlDatabase): Promise<Record<string, string>> {
    const rows = await db.query<{
        key: string;
        value: string;
    }>('SELECT key, value FROM metadata');
    return Object.fromEntries(rows.map(row => [row.key, row.value]));
}
