/// <reference types="node" />
// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { pool as defaultPool } from '../../../../server/src/db/index';
import { createSnapshotExport } from '../../../../server/src/transfers/transfers.service';
import { previewImport } from '../../../../server/src/transfers/import-preview.service';
import { commitImport } from '../../../../server/src/transfers/import-commit.service';
import { createPhoneRefresh } from '../../../../server/src/transfers/phone-refresh.service';
import { migrate, metadata, type SqlDatabase } from './database';
import { createBootstrap } from './snapshot';
import { createSqliteWriteData } from './writeData';
import { freezeOutbound } from './outbound';
import { importRefresh } from './refresh';

it.skipIf(!process.env.TEST_DATABASE_URL)('round trips phone-created catalog, readings and tags through real PostgreSQL and SQLite twice', async () => {
    const target = new URL(process.env.TEST_DATABASE_URL!);
    if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === target.pathname) throw new Error('Use a disposable test database');
    const Pool = defaultPool.constructor as new (options: { connectionString: string }) => typeof defaultPool;
    const admin = new Pool({ connectionString: target.toString() });
    const name = `reading_tracker_roundtrip_${crypto.randomUUID().replaceAll('-', '')}`;
    const engine = new DatabaseSync(':memory:');
    let pg: typeof defaultPool | undefined;
    let created = false;
    try {
        await admin.query(`CREATE DATABASE "${name}"`); created = true;
        target.pathname = `/${name}`;
        pg = new Pool({ connectionString: target.toString() });
        const journal = JSON.parse(await readFile(new URL('../../../../server/drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        for (const entry of journal.entries) await pg.query(await readFile(new URL(`../../../../server/drizzle/${entry.tag}.sql`, import.meta.url), 'utf8'));
        await pg.query("INSERT INTO users(email,password_hash,role) VALUES ('roundtrip@example.test','unused','admin'); INSERT INTO genres(name) VALUES ('Fantasy')");
        const db: SqlDatabase = {
            execute: async sql => { engine.exec(sql); },
            run: async (sql, values = []) => { engine.prepare(sql).run(...values as SQLInputValue[]); },
            query: async <T,>(sql: string, values: unknown[] = []) => engine.prepare(sql).all(...values as SQLInputValue[]) as T[],
        };
        const device = crypto.randomUUID();
        await migrate(db, device);
        await createBootstrap(db)(await createSnapshotExport(1, device, pg), 'initial');
        const writes = createSqliteWriteData(db, async () => undefined);
        const canada = await writes.createCatalog!('countries','Canada');
        const france = await writes.createCatalog!('countries','France');
        const createdGenre = await writes.createCatalog!('genres','Phone genre');
        const author = await writes.createAuthor({ firstName: 'Phone', middleName: '', lastName: 'Author', countryIds: [canada.id,france.id], gender: null });
        const genre = createdGenre;
        const book = await writes.createBook({ title: 'Phone book', authorId: author.id, genre: { id: genre.id }, coAuthors: null, category: 'Fiction', pageCount: 100, tags: [{ name: 'Phone tag' }] });
        await writes.createReading({ bookId: book.id, startedOn: '2026-11-01', format: 'Print' });
        const outbound = JSON.parse(await freezeOutbound(db));
        const matches = outbound.changes.filter((c: { record: { entityType: string } }) => ['authors','books','countries','genres'].includes(c.record.entityType)).map((c: { record: { entityType: 'authors' | 'books'; entityId: string } }) => ({ entityType: c.record.entityType, incomingId: c.record.entityId, localId: null }));
        const preview = await previewImport(1, { exchange: outbound, matches }, pg);
        expect(preview.hasBlockingIssues).toBe(false);
        await commitImport(1, { exchange: outbound, matches, previewDigest: preview.previewDigest, choices: [] }, pg);
        const refresh = await createPhoneRefresh(1, outbound.transferId, pg);
        await importRefresh(db, refresh, 'round1');
        expect((await metadata(db)).pendingOutbound).toBeUndefined();
        const [localAuthor] = await db.query<{ id: number }>("SELECT id FROM authors WHERE json_extract(data,'$.lastName')='Author'");
        await writes.updateAuthor(localAuthor.id, { firstName: 'Corrected', middleName: '', lastName: 'Author', countryIds: [canada.id,france.id], gender: null });
        await pg.query("UPDATE books SET page_count=200 WHERE title='Phone book'");
        await writes.renameCatalog!('countries',canada.id,'Canada renamed');
        await writes.renameCatalog!('genres',createdGenre.id,'Genre renamed');
        const second = JSON.parse(await freezeOutbound(db));
        const next = await previewImport(1, second, pg);
        expect(next.counts.update).toBe(3);
        await commitImport(1, { exchange: second, previewDigest: next.previewDigest, choices: [] }, pg);
        await importRefresh(db, await createPhoneRefresh(1, second.transferId, pg), 'round2');
        expect((await pg.query('SELECT first_name FROM authors')).rows[0].first_name).toBe('Corrected');
        expect(JSON.parse((await db.query<{ data: string }>('SELECT data FROM books'))[0].data).pageCount).toBe(200);
        expect((await pg.query('SELECT count(*)::int AS count FROM author_countries')).rows[0].count).toBe(2);
        expect((await pg.query('SELECT name FROM countries ORDER BY name')).rows.map(r=>r.name)).toEqual(['Canada renamed','France']);
        expect(await db.query('PRAGMA foreign_key_check')).toEqual([]);
        expect(await db.query('SELECT * FROM readings')).toHaveLength(1);
        expect(await db.query('SELECT * FROM book_tags')).toHaveLength(1);
    } finally {
        engine.close(); await pg?.end();
        if (created) await admin.query(`DROP DATABASE "${name}"`);
        await admin.end();
    }
}, 30000);
