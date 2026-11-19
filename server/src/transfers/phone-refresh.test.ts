import { expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPhoneRefresh } from './phone-refresh.service.js';
import { phoneRefresh } from './transfer-contract.js';
import { randomUUID } from 'node:crypto';
const laptop = randomUUID(), phone = randomUUID(), library = randomUUID(), transfer = randomUUID();
const exchange = { format: 'reading-tracker', version: 2, kind: 'changes', transferId: transfer, sourceDeviceId: phone, destinationDeviceId: laptop, libraryId: library, changes: [] };
const saved = { format: 'reading-tracker', version: 2, kind: 'phone-refresh', exchange,
  snapshot: { format: 'reading-tracker', version: 2, kind: 'snapshot', transferId: randomUUID(), sourceDeviceId: laptop, destinationDeviceId: phone, libraryId: library, records: [] } };
it('rejects mismatched exchange and snapshot identities', () => {
  expect(phoneRefresh.safeParse({ ...saved, snapshot: { ...saved.snapshot, libraryId: randomUUID() } }).success).toBe(false);
});
it('returns the exact saved refresh rather than exporting later edits', async () => {
  const statements: string[] = [];
  const client = { query: async (sql: string) => {
    statements.push(sql);
    return { rows: sql.includes('SELECT result') ? [{ result: { confirmedExchange: exchange } }] : sql.includes('SELECT payload') ? [{ payload: saved }] : [] };
  }, release() {} };
  expect(await createPhoneRefresh(1, transfer, { connect: async () => client } as unknown as Pick<Pool, 'connect'>)).toEqual(saved);
  expect(statements.some(sql => sql.includes('transfer_states'))).toBe(false);
});
it('refuses to create a refresh without a completed import', async () => {
  const statements: string[] = [];
  const client = { query: async (sql: string) => { statements.push(sql); return { rows: [] }; }, release() {} };
  await expect(createPhoneRefresh(1, transfer, { connect: async () => client } as unknown as Pick<Pool, 'connect'>)).rejects.toMatchObject({ status: 409 });
  expect(statements.at(-1)).toBe('ROLLBACK');
});
