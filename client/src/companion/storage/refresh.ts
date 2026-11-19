import { phoneRefresh, type PhoneRefresh } from '../../../../server/src/transfers/transfer-contract';
import { metadata, type SqlDatabase } from './database';
import { createBootstrap } from './snapshot';

export function checkRefresh(info: Record<string, string>, input: unknown): PhoneRefresh {
    const value = phoneRefresh.parse(input);
    if (value.snapshot.libraryId !== info.libraryId || value.snapshot.sourceDeviceId !== info.sourceDeviceId || value.snapshot.destinationDeviceId !== info.deviceId)
        throw new Error('This refresh belongs to a different library or device.');
    // Parse into the same property order before comparing; reject changed proposals.
    if (!info.pendingOutbound || JSON.stringify(value.exchange) !== JSON.stringify(JSON.parse(info.pendingOutbound)))
        throw new Error('This refresh does not confirm the pending phone export.');
    return value;
}
export async function importRefresh(db: SqlDatabase, input: unknown, hash: string): Promise<'imported' | 'repeat'> {
    const info = await metadata(db);
    const parsed = phoneRefresh.parse(input);
    if (info.lastRefreshHash === hash && info.lastRefreshId === parsed.snapshot.transferId) return 'repeat';
    const value = checkRefresh(info, parsed);
    const ids = new Map<string, number>();
    const maxima = new Map<string, number>();
    const bootstrap = createBootstrap(db, async () => {
        checkRefresh(await metadata(db), value);
        for (const [type, table] of [['countries','countries'],['authors','authors'],['genres','genres'],['tags','tags'],['books','books'],['readings','readings'],['bookTags','book_tag_sets']]) {
            const rows = await db.query<{ id: number; uuid: string }>(`SELECT id,uuid FROM ${table}`);
            for (const row of rows) ids.set(`${type}:${row.uuid}`, row.id);
            maxima.set(type, Math.max(0, ...rows.map(row => row.id)));
        }
        for (const table of ['author_countries', 'book_tags', 'book_tag_sets', 'readings', 'books', 'authors', 'genres', 'tags', 'countries', 'local_changes', 'current_records', 'baselines'])
            await db.run(`DELETE FROM ${table}`);
        await db.run("DELETE FROM metadata WHERE key NOT IN ('deviceId')");
        await db.run("INSERT INTO metadata(key,value) VALUES ('lastRefreshHash',?),('lastRefreshId',?)", [hash, value.snapshot.transferId]);
    }, record => {
        const existing = ids.get(`${record.entityType}:${record.entityId}`);
        if (existing) return existing;
        const next = (maxima.get(record.entityType) ?? 0) + 1;
        maxima.set(record.entityType, next);
        return next;
    });
    return bootstrap(value.snapshot, hash);
}
