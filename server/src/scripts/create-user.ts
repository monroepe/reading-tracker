import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import { hash } from '@node-rs/argon2';
import { db, pool } from '../db/index.js';
import { pgError } from '../db/errors.js';
import { users } from '../db/schema.js';

async function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const pending = rl.question(question);
  muted = true; // the prompt is already printed; hide what gets typed
  const answer = await pending;
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function main() {
  const email = process.argv[2]?.trim();
  if (!email || process.argv.slice(3).some((arg) => arg !== '--admin')) throw new Error('Usage: npm run create-user -- <email> [--admin]');
  const role = process.argv.includes('--admin') ? 'admin' : 'user';

  const password = await promptHidden('Password (12+ characters): ');
  if (password.length < 12) throw new Error('Password must be at least 12 characters');
  if (password !== (await promptHidden('Confirm password: '))) {
    throw new Error('Passwords do not match');
  }

  try {
    await db.insert(users).values({ email, passwordHash: await hash(password), role });
  } catch (err) {
    if (pgError(err)?.code === '23505') throw new Error('A user with that email already exists');
    throw err;
  }
  console.log(`Created user ${email}`);
}

main()
  .catch((err: Error) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
