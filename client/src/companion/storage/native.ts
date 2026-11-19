import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { migrate, metadata, type SqlDatabase } from './database';
import { createSqliteReadData } from './readData';
import { createSqliteWriteData } from './writeData';
async function open() {
    if (Capacitor.getPlatform() !== 'android')
        throw new Error('The companion uses native Android SQLite. Install the APK to use it.');
    const connections = new SQLiteConnection(CapacitorSQLite);
    await connections.checkConnectionsConsistency();
    const name = 'reading_tracker_companion';
    const connection = (await connections.isConnection(name, false)).result
        ? await connections.retrieveConnection(name, false)
        : await connections.createConnection(name, false, 'no-encryption', 1, false);
    await connection.open();
    const db: SqlDatabase = {
        execute: async (sql) => {
            if (sql === 'BEGIN IMMEDIATE')
                await connection.beginTransaction();
            else if (sql === 'COMMIT')
                await connection.commitTransaction();
            else if (sql === 'ROLLBACK')
                await connection.rollbackTransaction();
            else
                await connection.execute(sql, false);
        },
        run: async (sql, values = []) => { await connection.run(sql, values, false); },
        query: async <T,>(sql: string, values: unknown[] = []) => (await connection.query(sql, values)).values as T[] ?? [],
    };
    await migrate(db, crypto.randomUUID());
    let projection = await createSqliteReadData(db);
    let projectionError: unknown;
    const reads = Object.fromEntries(Object.entries(projection).map(([group, methods]) => [group, Object.fromEntries(Object.keys(methods).map(method => [method, (...args: unknown[]) => {
        if (projectionError) throw new Error('Saved on this phone. Close and reopen the app to reload your library.');
        const current = projection[group as keyof typeof projection] as unknown as Record<string, (...args: unknown[]) => unknown>;
        return current[method](...args);
    }]))])) as unknown as typeof projection;
    async function refresh() {
        try { projection = await createSqliteReadData(db); projectionError = undefined; }
        catch (error) { projectionError = error; }
    }
    let queue: Promise<unknown> = Promise.resolve();
    function serialized<T>(work: () => Promise<T>): Promise<T> {
        const result = queue.then(work);
        queue = result.catch(() => undefined);
        return result;
    }
    const repository = createSqliteWriteData(db, refresh);
    const writes = Object.fromEntries(Object.entries(repository).map(([key, method]) => [key, (...args: unknown[]) => serialized(() => (method as (...values: unknown[]) => Promise<unknown>)(...args))])) as unknown as typeof repository;
    const exportChanges = () => serialized(async () => (await import('./outbound')).freezeOutbound(db));
    const applyRefresh = (input: unknown, hash: string) => serialized(async () => (await import('./refresh')).importRefresh(db, input, hash));
    return { writes, exportChanges, applyRefresh, db, bootstrap: async (...args: Parameters<ReturnType<typeof import('./snapshot').createBootstrap>>) => serialized(async () => (await import('./snapshot')).createBootstrap(db)(...args)), info: () => metadata(db), reads: async () => reads, reload: refresh };
}
export type CompanionStorage = Awaited<ReturnType<typeof open>>;
// One connection/initialization even when StrictMode mounts twice. On failure,
// keep the error visible; a cold restart can retry without erasing data.
let opening: Promise<CompanionStorage> | undefined;
export function openCompanionStorage() { return opening ??= open(); }
