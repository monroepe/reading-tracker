/// <reference types="node" />
// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import { migrate, metadata, type SqlDatabase } from './database';
import { createBootstrap } from './snapshot';
import { freezeOutbound } from './outbound';
import { importRefresh } from './refresh';
import { createSqliteWriteData } from './writeData';
import { fixture, uuid } from './fixtures.test-helper';
const engines: DatabaseSync[] = [];
afterEach(() => { for (const engine of engines.splice(0)) engine.close(); });
async function setup() {
    const engine = new DatabaseSync(':memory:'); engines.push(engine);
    const db: SqlDatabase = {
        execute: async sql => { engine.exec(sql); },
        run: async (sql, values = []) => { engine.prepare(sql).run(...values as SQLInputValue[]); },
        query: async <T,>(sql: string, values: unknown[] = []) => engine.prepare(sql).all(...values as SQLInputValue[]) as T[],
    };
    await migrate(db, uuid(4)); await createBootstrap(db)(fixture(), 'initial');
    return { db, writes: createSqliteWriteData(db, async () => undefined) };
}
function response(serialized: string, records = fixture().records, id = uuid(900)) {
    return { format: 'reading-tracker', version: 2, kind: 'phone-refresh', exchange: JSON.parse(serialized),
        snapshot: { ...fixture(), transferId: id, destinationDeviceId: uuid(4), records } };
}
it('freezes final changes, blocks saves, retries unchanged, and completes two cycles', async () => {
    const { db, writes } = await setup();
    const author = await writes.createAuthor({ firstName: 'New', middleName: '', lastName: 'Author', country: null, gender: null });
    await writes.updateAuthor(author.id, { firstName: 'Final', middleName: '', lastName: 'Author', country: null, gender: null });
    const first = await freezeOutbound(db);
    expect(JSON.parse(first).changes).toHaveLength(1);
    expect(JSON.parse(first).changes[0].baseline).toBeNull();
    expect(await freezeOutbound(db)).toBe(first);
    await expect(writes.createAuthor({ firstName: '', middleName: '', lastName: 'Blocked', country: null, gender: null })).rejects.toThrow('paused');
    const record = JSON.parse(first).changes[0].record;
    const records = [...fixture().records, record];
    await importRefresh(db, response(first, records), 'return1');
    expect((await metadata(db)).pendingOutbound).toBeUndefined();
    expect((await metadata(db)).deviceId).toBe(uuid(4));
    expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(await db.query('SELECT * FROM local_changes')).toEqual([]);
    const [row] = await db.query<{ id: number }>('SELECT id FROM authors WHERE uuid=?', [record.entityId]);
    await writes.updateAuthor(row.id, { firstName: 'Again', middleName: '', lastName: 'Author', country: null, gender: null });
    const second = await freezeOutbound(db);
    expect(JSON.parse(second).changes[0].baseline).toEqual(record);
    await expect(importRefresh(db, response(first, records), 'old')).rejects.toThrow('pending');
    const secondRecord = JSON.parse(second).changes[0].record;
    await importRefresh(db, response(second, [...fixture().records, secondRecord], uuid(901)), 'return2');
    expect(await importRefresh(db, response(second, [...fixture().records, secondRecord], uuid(901)), 'return2')).toBe('repeat');
});
it('rejects mismatched confirmations and rolls replacement back after a database failure', async () => {
    const { db } = await setup();
    const pending = await freezeOutbound(db);
    const wrong = response(pending); wrong.exchange.transferId = uuid(999);
    await expect(importRefresh(db, wrong, 'wrong')).rejects.toThrow('pending');
    await db.execute("CREATE TRIGGER fail_refresh BEFORE INSERT ON authors BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
    await expect(importRefresh(db, response(pending), 'failed')).rejects.toThrow('forced failure');
    expect((await metadata(db)).pendingOutbound).toBe(pending);
    expect(await db.query('SELECT * FROM books')).toHaveLength(2);
    expect((await metadata(db)).transferId).toBe(uuid(1));
});
it('refreshes laptop-only changes using an empty phone export', async () => {
    const { db } = await setup(); const pending = await freezeOutbound(db);
    expect(JSON.parse(pending).changes).toEqual([]);
    await importRefresh(db, response(pending, []), 'empty');
    expect(await db.query('SELECT * FROM books')).toEqual([]);
    expect((await metadata(db)).pendingOutbound).toBeUndefined();
});
