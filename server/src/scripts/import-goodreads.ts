import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { defaultCsvPath, runGoodreadsImport } from '../imports/goodreads.js';

async function main() {
  const args = process.argv.slice(2);
  let userId: number | undefined;
  let csvPath = defaultCsvPath;
  let reportPath: string | undefined;
  let commit = false;
  let verify = false;
  const usage = 'Usage: npm run import:goodreads -- --user-id 1 [--csv <path>] [--report <path>] [--commit | --verify]';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--commit') commit = true;
    else if (arg === '--verify') verify = true;
    else if (['--user-id', '--csv', '--report'].includes(arg ?? '') && args[i + 1] && !args[i + 1].startsWith('--')) {
      const value = args[++i]!;
      if (arg === '--user-id') userId = Number(value);
      else if (arg === '--csv') csvPath = resolve(value);
      else reportPath = resolve(value);
    } else throw new Error(usage);
  }
  if (!userId || !Number.isSafeInteger(userId) || userId < 1 || (commit && verify)) throw new Error(usage);
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  // PostgreSQL DATE is a calendar date, not a timezone-dependent JavaScript Date.
  pg.types.setTypeParser(1082, (value) => value);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const report = await runGoodreadsImport(client, { userId, csvPath, commit, verify });
    const output = `${JSON.stringify(report, null, 2)}\n`;
    console.log(output);
    if (reportPath) {
      try { await writeFile(reportPath, output, { flag: 'wx' }); }
      catch { throw new Error(`Database result is shown above, but report file could not be created: ${reportPath}`); }
    }
  } finally { await client.end(); }
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
