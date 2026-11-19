import type { Pool } from 'pg';
import { pool } from '../db/index.js';
import { HttpError } from '../middleware/errors.js';
import { buildSnapshot } from './transfers.service.js';
import { phoneRefresh, type PhoneRefresh } from './transfer-contract.js';

export async function createPhoneRefresh(userId: number, importId: string, database: Pick<Pool, 'connect'> = pool): Promise<PhoneRefresh> {
  const client = await database.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const receipt = (await client.query('SELECT result, created_at FROM transfer_imports WHERE transfer_id=$1 AND user_id=$2 FOR UPDATE', [importId, userId])).rows[0];
    if (!receipt?.result.confirmedExchange) throw new HttpError(409, 'Import this phone file successfully before downloading its refresh');
    const existing = (await client.query('SELECT payload FROM transfer_refreshes WHERE import_id=$1 AND user_id=$2', [importId, userId])).rows[0];
    const payload = existing?.payload ?? phoneRefresh.parse({ format: 'reading-tracker', version: 2, kind: 'phone-refresh', createdAt: new Date().toISOString(),
      exchange: receipt.result.confirmedExchange,
      snapshot: await buildSnapshot(client, userId, receipt.result.confirmedExchange.sourceDeviceId) });
    if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 10 * 1024 * 1024) throw new HttpError(413, 'Refresh exceeds the 10 MiB limit');
    if (!existing) await client.query('INSERT INTO transfer_refreshes(import_id,user_id,payload) VALUES($1,$2,$3::json)', [importId, userId, JSON.stringify(payload)]);
    await client.query('COMMIT');
    return existing && !payload.createdAt && receipt.created_at ? { ...payload, createdAt: new Date(receipt.created_at).toISOString() } : payload;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
