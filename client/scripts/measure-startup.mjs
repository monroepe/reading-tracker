import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Follow static imports only; include the chosen lazy list view separately.
const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const directory of ['dist', 'dist-companion']) {
  const root = resolve(client, directory);
  const manifest = JSON.parse(readFileSync(resolve(root, '.vite/manifest.json'), 'utf8'));
  const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
  function graph(keys, seen = new Set()) {
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      graph(manifest[key].imports ?? [], seen);
    }
    return seen;
  }
  function measure(keys) {
    const files = [...new Set([...graph(keys)].map(key => manifest[key].file))]
      .filter(file => file.endsWith('.js'));
    const buffers = files.map(file => readFileSync(resolve(root, file)));
    return {
      chunks: files.length,
      raw: buffers.reduce((sum, data) => sum + data.length, 0),
      gzip: buffers.reduce((sum, data) => sum + gzipSync(data).length, 0),
    };
  }
  const startup = graph([entry]);
  for (const key of Object.keys(manifest)) {
    if (/\/(?:\w+(?:Desktop|Mobile)View|Settings)\.tsx$/.test(key)
      || /\/storage\/(?:snapshot|outbound|refresh)\.ts$/.test(key)) {
      if (startup.has(key)) throw new Error(`Unexpected eager module: ${key}`);
    }
  }
  const result = { static: measure([entry]) };
  for (const view of ['Desktop', 'Mobile']) {
    const key = Object.keys(manifest).find(key => key.endsWith(`/Readings${view}View.tsx`));
    if (!key) throw new Error(`Missing ${view} view in ${directory}`);
    result[`firstLog${view}`] = measure([entry, key]);
  }
  console.log(directory, JSON.stringify(result));
}
