// Only this adapter may import the pure server wire contract.
import { snapshotExchange, type SnapshotExchange, type SnapshotRecord } from '../../../../server/src/transfers/transfer-contract';
import { metadata, transaction, type SqlDatabase } from './database';
export type { SnapshotExchange, SnapshotRecord };
export const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
export async function readSnapshot(file: File): Promise<{
    snapshot: SnapshotExchange;
    hash: string;
}> {
    if (file.size > MAX_SNAPSHOT_BYTES)
        throw new Error('Snapshot exceeds the 10 MiB limit.');
    const bytes = await file.arrayBuffer();
    const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (input?.version !== 2) throw new Error('Unsupported transfer version. Export a new version-2 snapshot from the updated laptop app.');
    const snapshot = snapshotExchange.parse(input);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return { snapshot, hash: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') };
}
export function checkBootstrap(info: Record<string, string>, snapshot: SnapshotExchange, hash: string): 'new' | 'repeat' {
    if (snapshot.sourceDeviceId === info.deviceId)
        throw new Error('Snapshot source cannot be this phone.');
    if (snapshot.destinationDeviceId && snapshot.destinationDeviceId !== info.deviceId)
        throw new Error('This snapshot is addressed to another device.');
    if (!info.transferId)
        return 'new';
    if (info.transferId === snapshot.transferId && info.hash === hash)
        return 'repeat';
    if (info.transferId === snapshot.transferId)
        throw new Error('This transfer ID was already imported with different content.');
    throw new Error('This library is already initialized. Additional transfers are not supported yet.');
}
export function createBootstrap(db: SqlDatabase, beforeImport?: () => Promise<void>, idForRecord?: (record: SnapshotRecord) => number) {
    let busy = false;
    return async (snapshot: SnapshotExchange, hash: string): Promise<'imported' | 'repeat'> => {
        if (busy)
            throw new Error('An import is already running.');
        busy = true;
        try {
            // Validate again at the write boundary, even if the caller previewed it.
            snapshot = snapshotExchange.parse(snapshot);
            return await transaction(db, async () => {
                await beforeImport?.();
                if (checkBootstrap(await metadata(db), snapshot, hash) === 'repeat')
                    return 'repeat';
                const ids = new Map<string, number>();
                for (const record of snapshot.records) {
                    await db.run('INSERT INTO baselines(entity_type, uuid, revision, record) VALUES (?, ?, ?, ?)', [record.entityType, record.entityId, record.revision, JSON.stringify(record)]);
                }
                await db.run('INSERT INTO current_records SELECT entity_type, uuid, record FROM baselines');
                for (const type of ['countries', 'genres', 'tags', 'authors', 'books', 'readings', 'bookTags'] as const) {
                    let id = 0;
                    for (const record of snapshot.records) {
                        if (record.entityType !== type || !record.data)
                            continue;
                        id = idForRecord ? idForRecord(record) : id + 1;
                        ids.set(`${type}:${record.entityId}`, id);
                        const ref = (entity: string, uuid: string) => {
                            const value = ids.get(`${entity}:${uuid}`);
                            if (!value)
                                throw new Error('Missing imported reference.');
                            return value;
                        };
                        if (record.entityType === 'authors') {
                            await db.run('INSERT INTO authors(id,uuid,data) VALUES (?,?,?)', [id, record.entityId, JSON.stringify(record.data)]);
                            for (const country of record.data.countryIds) await db.run('INSERT INTO author_countries(author_id,country_id) VALUES (?,?)', [id, ref('countries', country)]);
                        } else if (record.entityType === 'books') {
                            await db.run('INSERT INTO books(id, uuid, data, author_id, genre_id) VALUES (?, ?, ?, ?, ?)', [id, record.entityId, JSON.stringify(record.data), ref('authors', record.data.authorId), ref('genres', record.data.genreId)]);
                        }
                        else if (record.entityType === 'readings') {
                            await db.run('INSERT INTO readings(id, uuid, data, book_id) VALUES (?, ?, ?, ?)', [id, record.entityId, JSON.stringify(record.data), ref('books', record.data.bookId)]);
                        }
                        else if (record.entityType === 'bookTags') {
                            await db.run('INSERT INTO book_tag_sets(id, uuid, book_id) VALUES (?, ?, ?)', [id, record.entityId, ref('books', record.data.bookId)]);
                            for (const tag of record.data.tagIds)
                                await db.run('INSERT INTO book_tags(selection_id, tag_id) VALUES (?, ?)', [id, ref('tags', tag)]);
                        }
                        else {
                            // Table identifiers come exclusively from the discriminated contract.
                            await db.run(`INSERT INTO ${record.entityType}(id, uuid, data) VALUES (?, ?, ?)`, [id, record.entityId, JSON.stringify(record.data)]);
                        }
                    }
                }
                const receipt = { libraryId: snapshot.libraryId, sourceDeviceId: snapshot.sourceDeviceId, transferId: snapshot.transferId, hash, importedAt: new Date().toISOString() };
                for (const [key, value] of Object.entries(receipt))
                    await db.run('INSERT INTO metadata(key, value) VALUES (?, ?)', [key, value]);
                return 'imported';
            });
        }
        finally {
            busy = false;
        }
    };
}
