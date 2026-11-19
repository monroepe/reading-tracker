import { previewExchange, type PreviewExchange } from '../../../../server/src/transfers/transfer-contract';
import { metadata, transaction, type SqlDatabase } from './database';
import type { SnapshotRecord } from './snapshot';

/** Freeze one final proposal per entity; the full revision journal remains intact. */
export function buildOutbound(info: Record<string, string>, baselines: SnapshotRecord[], current: SnapshotRecord[]): PreviewExchange {
    const baseline = new Map(baselines.map(record => [`${record.entityType}:${record.entityId}`, record]));
    const changes = current.flatMap(record => {
        const prior = baseline.get(`${record.entityType}:${record.entityId}`) ?? null;
        if (prior && JSON.stringify(prior.data) === JSON.stringify(record.data)) return [];
        return [{ changeId: crypto.randomUUID(), originDeviceId: info.deviceId, baseline: prior, record }];
    });
    return previewExchange.parse({ format: 'reading-tracker', version: 2, kind: 'changes', createdAt: new Date().toISOString(),
        transferId: crypto.randomUUID(), libraryId: info.libraryId, sourceDeviceId: info.deviceId,
        destinationDeviceId: info.sourceDeviceId, changes });
}

/** Run through the same serialized operation queue as local saves. */
export async function freezeOutbound(db: SqlDatabase): Promise<string> {
    return transaction(db, async () => {
        const info = await metadata(db);
        if (!info.transferId) throw new Error('Import a laptop snapshot first.');
        if (info.pendingOutbound) return info.pendingOutbound;
        const baselines = await db.query<{ record: string }>('SELECT record FROM baselines ORDER BY entity_type, uuid');
        const current = await db.query<{ record: string }>('SELECT record FROM current_records ORDER BY entity_type, uuid');
        const serialized = JSON.stringify(buildOutbound(info, baselines.map(row => JSON.parse(row.record)), current.map(row => JSON.parse(row.record))));
        if (new TextEncoder().encode(serialized).length > 10 * 1024 * 1024) throw new Error('Export exceeds the 10 MiB transfer limit.');
        await db.run("INSERT INTO metadata(key, value) VALUES ('pendingOutbound', ?)", [serialized]);
        return serialized;
    });
}
