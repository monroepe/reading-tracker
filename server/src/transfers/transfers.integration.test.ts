import { createPhoneRefresh } from './phone-refresh.service.js';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { expect, it } from 'vitest';
import { createSnapshotExport } from './transfers.service.js';
import { previewImport } from './import-preview.service.js';
import { previewExchange } from './transfer-contract.js';
import { remapRecord } from './catalog-mappings.js';
import { commitImport } from './import-commit.service.js';

it.skipIf(!process.env.TEST_DATABASE_URL)('exports an owner-scoped snapshot and atomically retains its exact manifest', async () => {
  const target = new URL(process.env.TEST_DATABASE_URL!);
  if (process.env.DATABASE_URL) {
    const real = new URL(process.env.DATABASE_URL);
    if (target.hostname === real.hostname && target.port === real.port && target.pathname === real.pathname) {
      throw new Error('Use a disposable test database');
    }
  }
  const database = `reading_tracker_export_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: target.toString() });
  let pool: pg.Pool | undefined;
  let created = false;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    target.pathname = `/${database}`;
    pool = new pg.Pool({ connectionString: target.toString() });
    const journal = JSON.parse(await readFile(fileURLToPath(new URL('../../drizzle/meta/_journal.json', import.meta.url)), 'utf8'));
    for (const entry of journal.entries) {
      await pool.query(await readFile(fileURLToPath(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url)), 'utf8'));
    }
    await pool.query(`INSERT INTO users(email,password_hash) VALUES ('owner@example.test','private hash'), ('other@example.test','other hash');
      INSERT INTO authors(last_name) VALUES ('Author');
      INSERT INTO genres(name) VALUES ('Fantasy');
      INSERT INTO books(title,author_id,genre_id,category,page_count) VALUES ('Book',1,1,'Fiction',100);
      INSERT INTO tags(name,created_by_user_id) VALUES ('Own tag',1), ('Shared tag',2);
      INSERT INTO readings(user_id,book_id,started_on,format,rating,review) VALUES
        (1,1,'2026-01-01','Print',8.5,'Owner review'), (2,1,'2026-01-02','Kindle',NULL,'Other private review');
      INSERT INTO book_tags(user_id,book_id,tag_id) VALUES (1,1,1), (2,1,2)`);
    const owners = (await pool.query('SELECT library_id FROM users ORDER BY id')).rows;
    const journalBefore = (await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count;
    const destination = randomUUID();
    const exchange = await createSnapshotExport(1, destination, pool);
    expect(exchange.libraryId).toBe(owners[0].library_id);
    expect(exchange.destinationDeviceId).toBe(destination);
    expect(exchange.records.filter(row => row.entityType === 'readings')).toHaveLength(1);
    expect(exchange.records.filter(row => row.entityType === 'bookTags')).toHaveLength(1);
    expect(exchange.records.filter(row => row.entityType === 'tags').map(row => row.data)).toEqual(expect.arrayContaining([
      { name: 'Own tag', ownedByLibrary: true }, { name: 'Shared tag', ownedByLibrary: false },
    ]));
    const serialized = JSON.stringify(exchange);
    for (const secret of ['private hash', 'other hash', 'Other private review', 'owner@example.test', owners[1].library_id]) {
      expect(serialized).not.toContain(secret);
    }
    const receipt = (await pool.query('SELECT * FROM transfer_exports')).rows[0];
    expect(receipt.transfer_id).toBe(exchange.transferId);
    expect(receipt.user_id).toBe(1);
    expect(receipt.payload_sha256).toBe(createHash('sha256').update(serialized).digest('hex'));
    expect(receipt.manifest).toEqual(exchange.records.map(({ entityType, entityId, revision }) => ({ entityType, entityId, revision })));
    expect((await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count).toBe(journalBefore);

    const reading = exchange.records.find(record => record.entityType === 'readings')!;
    const proposed = { ...reading, revision: randomUUID(), data: { ...reading.data!, review: 'Corrected review' } };
    const phone = previewExchange.parse({
      format: 'reading-tracker', version: 2, kind: 'changes', transferId: randomUUID(),
      sourceDeviceId: destination, destinationDeviceId: exchange.sourceDeviceId, libraryId: exchange.libraryId,
      changes: [{ changeId: randomUUID(), originDeviceId: destination, baseline: reading, record: proposed }],
    });
    const preview = await previewImport(1, phone, pool);
    expect(preview.counts.update).toBe(1);
    expect(preview.hasBlockingIssues).toBe(false);
    expect(preview.requiresReview).toBe(false);
    expect(preview.previewDigest).toBe((await previewImport(1, JSON.parse(JSON.stringify(phone)), pool)).previewDigest);
    expect((await pool.query('SELECT review FROM readings WHERE user_id = 1')).rows[0].review).toBe('Owner review');
    expect((await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count).toBe(journalBefore);
    expect((await pool.query('SELECT count(*) FROM transfer_exports')).rows[0].count).toBe('1');
    await expect(previewImport(2, phone, pool)).rejects.toMatchObject({ status: 400 });
    await expect(previewImport(1, { ...phone, destinationDeviceId: randomUUID() }, pool)).rejects.toMatchObject({ status: 400 });
    const foreignId = (await pool.query('SELECT sync_id FROM readings WHERE user_id = 2')).rows[0].sync_id;
    await expect(previewImport(1, { ...phone, changes: [{ ...phone.changes[0], baseline: null,
      record: { ...proposed, entityId: foreignId } }] }, pool)).rejects.toMatchObject({ status: 400 });
    await pool.query("UPDATE readings SET review = 'Laptop correction' WHERE user_id = 1");
    const conflict = await previewImport(1, phone, pool);
    expect(conflict.counts.conflict).toBe(1);
    expect(conflict.requiresReview).toBe(true);
    expect(conflict.previewDigest).not.toBe(preview.previewDigest);

    await expect(createSnapshotExport(999, null, pool)).rejects.toMatchObject({ status: 401 });
    await expect(createSnapshotExport(1, exchange.sourceDeviceId, pool)).rejects.toMatchObject({ status: 400 });
    expect((await pool.query('SELECT count(*) FROM transfer_exports')).rows[0].count).toBe('1');

    // A failed manifest insert must not yield an apparently successful export.
    await pool.query(`CREATE FUNCTION reject_export() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Simulated disk write failure'; END $$;
      CREATE TRIGGER reject_export BEFORE INSERT ON transfer_exports FOR EACH ROW EXECUTE FUNCTION reject_export()`);
    await expect(createSnapshotExport(1, null, pool)).rejects.toThrow('Simulated disk write failure');
    expect((await pool.query('SELECT count(*) FROM transfer_exports')).rows[0].count).toBe('1');

    await expect(commitImport(1, { exchange: phone, previewDigest: preview.previewDigest, choices: [] }, pool))
      .rejects.toMatchObject({ status: 409 });
    await expect(commitImport(1, { exchange: phone, previewDigest: conflict.previewDigest, choices: [] }, pool))
      .rejects.toMatchObject({ status: 400 });
    expect((await pool.query('SELECT count(*) FROM transfer_imports')).rows[0].count).toBe('0');

    const clean = previewExchange.parse({ ...phone, transferId: randomUUID(), changes: [{
      ...phone.changes[0], changeId: randomUUID(), baseline: conflict.items[0].local,
      record: { ...proposed, revision: randomUUID(), data: { ...proposed.data, review: 'Committed phone review' } },
    }] });
    const cleanPreview = await previewImport(1, clean, pool);
    const cleanRequest = { exchange: clean, previewDigest: cleanPreview.previewDigest, choices: [] };
    // Receipt failures roll back the domain write AND trigger history.
    const beforeFailure = (await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count;
    await pool.query(`CREATE FUNCTION reject_import() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Receipt failure'; END $$;
      CREATE TRIGGER reject_import BEFORE INSERT ON transfer_imports FOR EACH ROW EXECUTE FUNCTION reject_import()`);
    await expect(commitImport(1, cleanRequest, pool)).rejects.toThrow('Receipt failure');
    expect((await pool.query('SELECT review FROM readings WHERE user_id=1')).rows[0].review).toBe('Laptop correction');
    expect((await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count).toBe(beforeFailure);
    expect((await pool.query('SELECT count(*) FROM transfer_import_changes')).rows[0].count).toBe('0');
    await pool.query('DROP TRIGGER reject_import ON transfer_imports');
    const committed = await commitImport(1, cleanRequest, pool);
    expect(committed.outcomes[0]).toMatchObject({ action: 'applied', record: clean.changes[0].record });
    expect((await pool.query('SELECT origin_device_id,revision FROM transfer_changes WHERE change_id=$1',
      [clean.changes[0].changeId])).rows[0]).toEqual({ origin_device_id: destination, revision: clean.changes[0].record.revision });
    const countAfterCommit = (await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count;
    expect(await commitImport(1, cleanRequest, pool)).toEqual(committed);
    const refresh = await createPhoneRefresh(1, cleanRequest.exchange.transferId, pool);
    expect(refresh.exchange).toEqual(cleanRequest.exchange);
    expect(refresh.snapshot.destinationDeviceId).toBe(destination);
    expect(refresh.snapshot.records.find(r => r.entityType === 'readings' && r.entityId === proposed.entityId)?.data).toEqual(cleanRequest.exchange.changes[0].record.data);
    await expect(createPhoneRefresh(2, cleanRequest.exchange.transferId, pool)).rejects.toMatchObject({ status: 409 });
    expect(await createPhoneRefresh(1, cleanRequest.exchange.transferId, pool)).toEqual(refresh);
    expect((await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count).toBe(countAfterCommit);
    await expect(commitImport(2, cleanRequest, pool)).rejects.toMatchObject({ status: 409 });
    await expect(commitImport(1, { ...cleanRequest, previewDigest: 'a'.repeat(64) }, pool)).rejects.toMatchObject({ status: 409 });

    const freshConflict = await previewImport(1, phone, pool);
    const resolved = await commitImport(1, { exchange: phone, previewDigest: freshConflict.previewDigest,
      choices: [{ changeId: phone.changes[0].changeId, choice: 'incoming' }] }, pool);
    expect(resolved.outcomes[0].record?.data).toEqual(proposed.data);
    expect(resolved.outcomes[0].record?.revision).not.toBe(proposed.revision);
    expect((await pool.query('SELECT proposal FROM transfer_import_changes WHERE change_id=$1',
      [phone.changes[0].changeId])).rows[0].proposal).toEqual(phone.changes[0]);

    const alteredRevision = previewExchange.parse({ ...phone, transferId: randomUUID(), changes: [{
      ...phone.changes[0], changeId: randomUUID(), record: { ...proposed, data: { ...proposed.data, review: 'Altered known revision' } },
    }] });
    expect((await previewImport(1, alteredRevision, pool)).counts.blocked).toBe(1);

    const repeat = { ...clean, transferId: randomUUID() };
    const repeatPreview = await previewImport(1, repeat, pool);
    const beforeRepeat = (await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count;
    expect((await commitImport(1, { exchange: repeat, previewDigest: repeatPreview.previewDigest, choices: [] }, pool)).outcomes)
      .toEqual(committed.outcomes);
    expect((await pool.query('SELECT count(*) FROM transfer_changes')).rows[0].count).toBe(beforeRepeat);

    const deletionFile = previewExchange.parse({ ...phone, transferId: randomUUID(), changes: [{
      ...phone.changes[0], changeId: randomUUID(), baseline: resolved.outcomes[0].record,
      record: { ...proposed, revision: randomUUID() },
    }] });
    await pool.query('DELETE FROM readings WHERE user_id=1');
    const deletionPreview = await previewImport(1, deletionFile, pool);
    await expect(commitImport(1, { exchange: deletionFile, previewDigest: deletionPreview.previewDigest,
      choices: [{ changeId: deletionFile.changes[0].changeId, choice: 'incoming' }] }, pool)).rejects.toMatchObject({ status: 400 });
    const kept = await commitImport(1, { exchange: deletionFile, previewDigest: deletionPreview.previewDigest,
      choices: [{ changeId: deletionFile.changes[0].changeId, choice: 'local' }] }, pool);
    expect(kept.outcomes[0]).toMatchObject({ action: 'local', record: { data: null } });
    expect((await pool.query('SELECT count(*) FROM readings WHERE user_id=1')).rows[0].count).toBe('0');
    const restoreFile = previewExchange.parse({ ...deletionFile, transferId: randomUUID(), changes: [{
      ...deletionFile.changes[0], changeId: randomUUID(), record: { ...proposed, revision: randomUUID() },
    }] });
    const restorePreview = await previewImport(1, restoreFile, pool);
    const restored = await commitImport(1, { exchange: restoreFile, previewDigest: restorePreview.previewDigest,
      choices: [{ changeId: restoreFile.changes[0].changeId, choice: 'restore' }] }, pool);
    expect(restored.outcomes[0].record?.data).toEqual(proposed.data);
    expect((await pool.query('SELECT count(*) FROM readings WHERE user_id=2')).rows[0].count).toBe('1');

    // Full selections, including empty selections, are each one tracked change.
    let selection = exchange.records.find(record => record.entityType === 'bookTags')!;
    for (const tagIds of [[], exchange.records.filter(record => record.entityType === 'tags').map(record => record.entityId)]) {
      const tagsFile = previewExchange.parse({ ...phone, transferId: randomUUID(), changes: [{
        changeId: randomUUID(), originDeviceId: destination, baseline: selection,
        record: { ...selection, revision: randomUUID(), data: { ...selection.data, tagIds } },
      }] });
      const tagsPreview = await previewImport(1, tagsFile, pool);
      const beforeTags = (await pool.query("SELECT count(*) FROM transfer_changes WHERE entity_type='bookTags'")).rows[0].count;
      const saved = await commitImport(1, { exchange: tagsFile, previewDigest: tagsPreview.previewDigest, choices: [] }, pool);
      const savedSelection = saved.outcomes[0].record!;
      if (savedSelection.entityType !== 'bookTags') throw new Error('Expected saved tag selection');
      selection = savedSelection;
      expect(selection.data).toEqual({ bookId: (exchange.records.find(record => record.entityType === 'books')!).entityId, tagIds: [...tagIds].sort() });
      expect(Number((await pool.query("SELECT count(*) FROM transfer_changes WHERE entity_type='bookTags'")).rows[0].count)).toBe(Number(beforeTags) + 1);
    }

    // Confirm catalog links, automatically match a shared tag, then rebase dependents.
    const author = exchange.records.find(r => r.entityType === 'authors')!;
    const book = exchange.records.find(r => r.entityType === 'books')!;
    const tag = exchange.records.find(r => r.entityType === 'tags' && r.data && !r.data.ownedByLibrary)!;
    const remoteAuthor = randomUUID(), remoteBook = randomUUID(), remoteTag = randomUUID();
    const matchedFile = previewExchange.parse({ ...phone, transferId: randomUUID(), changes: [
      { changeId: randomUUID(), originDeviceId: destination, baseline: null,
        record: { ...book, entityId: remoteBook, revision: randomUUID(), data: { ...book.data, authorId: remoteAuthor } } },
      { changeId: randomUUID(), originDeviceId: destination, baseline: null,
        record: { ...author, entityId: remoteAuthor, revision: randomUUID() } },
      { changeId: randomUUID(), originDeviceId: destination, baseline: null,
        record: { ...tag, entityId: remoteTag, revision: randomUUID(), data: { name: 'SHARED TAG', ownedByLibrary: true } } },
      { changeId: randomUUID(), originDeviceId: destination, baseline: null,
        record: { ...reading, entityId: randomUUID(), revision: randomUUID(), data: { ...reading.data, bookId: remoteBook } } },
    ] });
    const unmatched = await previewImport(1, matchedFile, pool);
    expect(unmatched.counts.match).toBe(2);
    const matches = [
      { entityType: 'authors', incomingId: remoteAuthor, localId: author.entityId },
      { entityType: 'books', incomingId: remoteBook, localId: book.entityId },
    ];
    const matchedPreview = await previewImport(1, { exchange: matchedFile, matches }, pool);
    expect(matchedPreview.hasBlockingIssues).toBe(false);
    expect(matchedPreview.counts.skip).toBe(3);
    expect(matchedPreview.counts.insert).toBe(1);
    expect(matchedPreview.items.find(i => i.incoming.entityType === 'books')?.candidates.map(c => c.entityId)).toContain(book.entityId);
    await expect(commitImport(1, { exchange: matchedFile, matches, previewDigest: unmatched.previewDigest, choices: [] }, pool))
      .rejects.toMatchObject({ status: 409 });
    const matchedRequest = { exchange: matchedFile, matches, previewDigest: matchedPreview.previewDigest, choices: [] };
    await pool.query(`CREATE TRIGGER reject_import BEFORE INSERT ON transfer_imports FOR EACH ROW EXECUTE FUNCTION reject_import()`);
    await expect(commitImport(1, matchedRequest, pool)).rejects.toThrow('Receipt failure');
    expect((await pool.query('SELECT count(*) FROM transfer_aliases')).rows[0].count).toBe('0');
    await pool.query('DROP TRIGGER reject_import ON transfer_imports');
    const matchedResult = await commitImport(1, matchedRequest, pool);
    expect(matchedResult.outcomes[3].record?.data).toEqual({ ...reading.data, bookId: book.entityId });
    expect(matchedResult.outcomes[3].record?.revision).not.toBe(matchedFile.changes[3].record.revision);
    expect((await pool.query('SELECT count(*) FROM transfer_aliases')).rows[0].count).toBe('3');
    expect((await pool.query('SELECT count(*) FROM books')).rows[0].count).toBe('1');
    expect(await commitImport(1, matchedRequest, pool)).toEqual(matchedResult);
    const later = { ...matchedFile, transferId: randomUUID(), changes: [{ ...matchedFile.changes[3],
      changeId: randomUUID(), record: { ...matchedFile.changes[3].record, entityId: randomUUID(), revision: randomUUID() } }] };
    const laterPreview = await previewImport(1, later, pool);
    expect(laterPreview.hasBlockingIssues).toBe(false);
    const laterResult = await commitImport(1, { exchange: later, previewDigest: laterPreview.previewDigest, choices: [] }, pool);
    expect(laterResult.outcomes[0].record?.data).toEqual({ ...reading.data, bookId: book.entityId });

    const tagSelection = remapRecord({ entityType: 'bookTags', entityId: randomUUID(), revision: randomUUID(),
      data: { bookId: remoteBook, tagIds: [remoteTag] } }, [], exchange.libraryId);
    const selectionFile = { ...phone, transferId: randomUUID(), changes: [{ changeId: randomUUID(), originDeviceId: destination,
      baseline: null, record: tagSelection }] };
    const selectionPreview = await previewImport(1, selectionFile, pool);
    expect(selectionPreview.counts.conflict).toBe(1);
    expect(selectionPreview.hasBlockingIssues).toBe(false);
    const selectionResult = await commitImport(1, { exchange: selectionFile, previewDigest: selectionPreview.previewDigest,
      choices: [{ changeId: selectionFile.changes[0].changeId, choice: 'incoming' }] }, pool);
    expect(selectionResult.outcomes[0].record?.data).toEqual({ bookId: book.entityId, tagIds: [tag.entityId] });

    // Review must explicitly confirm creation for a new catalog record.
    const newAuthorFile = { ...phone, transferId: randomUUID(), changes: [{ ...matchedFile.changes[1],
      changeId: randomUUID(), record: { ...author, entityId: randomUUID(), revision: randomUUID() } }] };
    const createMatches = [{ entityType: 'authors', incomingId: newAuthorFile.changes[0].record.entityId, localId: null }];
    const duplicateCreation = await previewImport(1, { exchange: newAuthorFile, matches: createMatches }, pool);
    expect(duplicateCreation.counts.blocked).toBe(1);
    newAuthorFile.changes[0].record = { ...newAuthorFile.changes[0].record,
      data: { ...author.data, lastName: 'Distinct author' } } as typeof newAuthorFile.changes[0]['record'];
    const creationPreview = await previewImport(1, { exchange: newAuthorFile, matches: createMatches }, pool);
    expect(creationPreview.counts.insert).toBe(1);
    await commitImport(1, { exchange: newAuthorFile, matches: createMatches, previewDigest: creationPreview.previewDigest, choices: [] }, pool);
    expect((await pool.query('SELECT count(*) FROM authors')).rows[0].count).toBe('2');
    const importedAgain = await previewImport(1, newAuthorFile, pool);
    expect(importedAgain.completedResult?.transferId).toBe(newAuthorFile.transferId);
    expect(importedAgain.items[0].reason).toBe('Already imported');
    await expect(previewImport(1, { exchange: newAuthorFile, matches: [{ ...createMatches[0], localId: randomUUID() }] }, pool))
      .rejects.toMatchObject({ status: 400 });

    // Discarding a book saves a receipt for the complete frozen proposal, without
    // creating its catalog/dependency rows. Other books still import atomically.
    const skippedBookId = randomUUID(), skippedAuthorId = randomUUID(), skippedTagId = randomUUID();
    const skippedSelection = createHash('md5').update(`${exchange.libraryId}:${skippedBookId}`).digest('hex');
    const skippedSelectionId = `${skippedSelection.slice(0,8)}-${skippedSelection.slice(8,12)}-${skippedSelection.slice(12,16)}-${skippedSelection.slice(16,20)}-${skippedSelection.slice(20)}`;
    const liveBook = exchange.records.find(r => r.entityType === 'books')!;
    const liveGenre = exchange.records.find(r => r.entityType === 'genres')!;
    const discardFile = previewExchange.parse({ ...phone, transferId: randomUUID(), changes: [
      { entityType: 'authors', entityId: skippedAuthorId, data: { firstName: 'Skipped', middleName: '', lastName: 'Author', countryIds: [], gender: null } },
      { entityType: 'tags', entityId: skippedTagId, data: { name: 'skipped tag', ownedByLibrary: true } },
      { entityType: 'books', entityId: skippedBookId, data: { title: 'Skipped book', authorId: skippedAuthorId, genreId: liveGenre.entityId, coAuthors: null, category: 'Fiction', pageCount: 200 } },
      { entityType: 'bookTags', entityId: skippedSelectionId, data: { bookId: skippedBookId, tagIds: [skippedTagId] } },
      { entityType: 'readings', entityId: randomUUID(), data: { bookId: skippedBookId, startedOn: '2026-11-01', finishedOn: null, dateUncertain: false, abandoned: false, format: 'Print', rating: null, review: null } },
      { entityType: 'readings', entityId: randomUUID(), data: { bookId: liveBook.entityId, startedOn: '2026-11-02', finishedOn: null, dateUncertain: false, abandoned: false, format: 'Kindle', rating: null, review: null } },
    ].map(record => ({ changeId: randomUUID(), originDeviceId: destination, baseline: null, record: { ...record, revision: randomUUID() } })) });
    const unselectedPreview = await previewImport(1, discardFile, pool);
    const discardPreview = await previewImport(1, { exchange: discardFile, skippedBookIds: [skippedBookId] }, pool);
    expect(discardPreview.hasBlockingIssues).toBe(false);
    expect(discardPreview.discardedChangeIds).toHaveLength(5);
    expect(discardPreview.previewDigest).not.toBe(unselectedPreview.previewDigest);
    const discardRequest = { exchange: discardFile, skippedBookIds: [skippedBookId], previewDigest: discardPreview.previewDigest, choices: [] };
    const discardResult = await commitImport(1, discardRequest, pool);
    expect(discardResult.outcomes.map(o => o.action)).toEqual(['discarded', 'discarded', 'discarded', 'discarded', 'discarded', 'applied']);
    expect((await pool.query('SELECT 1 FROM books WHERE sync_id=$1', [skippedBookId])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM authors WHERE sync_id=$1', [skippedAuthorId])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM tags WHERE sync_id=$1', [skippedTagId])).rowCount).toBe(0);
    expect(await commitImport(1, discardRequest, pool)).toEqual(discardResult);
    expect((await previewImport(1, discardFile, pool)).completedResult?.transferId).toBe(discardFile.transferId);
    const discardedRefresh = await createPhoneRefresh(1, discardFile.transferId, pool);
    expect(discardedRefresh.exchange).toEqual(discardFile);
    expect(discardedRefresh.snapshot.records.some(r => r.entityId === skippedBookId)).toBe(false);
    expect(discardedRefresh.snapshot.records.some(r => r.entityId === discardFile.changes[5].record.entityId)).toBe(true);
    const otherDevice = { ...later, sourceDeviceId: randomUUID() };
    otherDevice.changes = otherDevice.changes.map(c => ({ ...c, originDeviceId: otherDevice.sourceDeviceId }));
    await expect(previewImport(1, otherDevice, pool)).rejects.toMatchObject({ status: 409 });
    await pool.query('DELETE FROM tags WHERE sync_id=$1', [tag.entityId]);
    const deletedTarget = { ...matchedFile, transferId: randomUUID(), changes: [{ ...matchedFile.changes[2], changeId: randomUUID() }] };
    expect((await previewImport(1, deletedTarget, pool)).counts.blocked).toBe(1);
    expect(await createPhoneRefresh(1, cleanRequest.exchange.transferId, pool)).toEqual(refresh);
  } finally {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
}, 30000);
