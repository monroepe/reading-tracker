import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { expect, it } from 'vitest';
import { createSnapshotExport } from './transfers.service.js';
import { previewImport } from './import-preview.service.js';
import { commitImport } from './import-commit.service.js';
import type { PreviewExchange, SnapshotRecord } from './transfer-contract.js';

it.skipIf(!process.env.TEST_DATABASE_URL)('backfills countries without rewriting history and resolves rename collisions without blocking other changes', async()=>{
  const target = new URL(process.env.TEST_DATABASE_URL!);
  if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname===target.pathname) throw new Error('Use a disposable database');
  const admin = new pg.Pool({connectionString:target.toString()});
  const name = 'reading_tracker_countries_'+randomUUID().replaceAll('-','');
  let pool:pg.Pool|undefined;
  let created=false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);created=true;
    target.pathname='/'+name;pool=new pg.Pool({connectionString:target.toString()});
    const journal=JSON.parse(await readFile(new URL('../../drizzle/meta/_journal.json',import.meta.url),'utf8'));
    for(const entry of journal.entries.filter((e:{idx:number})=>e.idx<13)) await pool.query(await readFile(new URL(`../../drizzle/${entry.tag}.sql`,import.meta.url),'utf8'));
    await pool.query("INSERT INTO users(email,password_hash,role) VALUES ('countries@example.test','unused','admin'); INSERT INTO authors(last_name,country) VALUES ('One',' Canada '),('Two','canada'),('Three',NULL);");
    const history=(await pool.query('SELECT * FROM transfer_changes ORDER BY change_id')).rows;
    await pool.query(await readFile(new URL('../../drizzle/0013_known_supreme_intelligence.sql',import.meta.url),'utf8'));
    expect((await pool.query('SELECT count(*)::int AS n FROM countries')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM author_countries')).rows[0].n).toBe(2);
    for(const previous of history) expect((await pool.query('SELECT * FROM transfer_changes WHERE change_id=$1',[previous.change_id])).rows[0]).toEqual(previous);
    await pool.query("INSERT INTO countries(name) VALUES ('France'); INSERT INTO genres(name) VALUES ('Genre');");
    const snapshot=await createSnapshotExport(1,randomUUID(),pool);
    const canada=snapshot.records.find(r=>r.entityType==='countries' && r.data?.name==='Canada')! as Extract<SnapshotRecord,{entityType:'countries'}>;
    const genre=snapshot.records.find(r=>r.entityType==='genres')! as Extract<SnapshotRecord,{entityType:'genres'}>;
    const exchange:PreviewExchange={format:'reading-tracker',version:2,kind:'changes',transferId:randomUUID(),sourceDeviceId:snapshot.destinationDeviceId!,destinationDeviceId:snapshot.sourceDeviceId,libraryId:snapshot.libraryId,changes:[
      {changeId:randomUUID(),originDeviceId:snapshot.destinationDeviceId!,baseline:canada,record:{...canada,revision:randomUUID(),data:{name:'France'}}},
      {changeId:randomUUID(),originDeviceId:snapshot.destinationDeviceId!,baseline:genre,record:{...genre,revision:randomUUID(),data:{name:'Renamed genre'}}},
    ]};
    const preview=await previewImport(1,exchange,pool);
    const collision=preview.items.find(i=>i.incoming.entityType==='countries')!;
    expect(collision.action).toBe('conflict');expect(collision.allowedChoices).toEqual(['local']);
    expect(preview.hasBlockingIssues).toBe(false);
    await expect(commitImport(1,{exchange,previewDigest:preview.previewDigest,choices:[{changeId:collision.changeId,choice:'incoming'}]},pool)).rejects.toThrow('keep the laptop');
    await commitImport(1,{exchange,previewDigest:preview.previewDigest,choices:[{changeId:collision.changeId,choice:'local'}]},pool);
    expect((await pool.query('SELECT name FROM countries ORDER BY name')).rows.map(r=>r.name)).toEqual(['Canada','France']);
    expect((await pool.query('SELECT name FROM genres')).rows[0].name).toBe('Renamed genre');
  } finally {
    await pool?.end();if(created) await admin.query(`DROP DATABASE "${name}"`);await admin.end();
  }
},30000);
