import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config.ts';

const boundary: Plugin = {
  name: 'companion-boundary',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const html = bundle['companion.html'];
    if (html?.type === 'asset') { this.emitFile({ type: 'asset', fileName: 'index.html', source: html.source }); delete bundle['companion.html']; }
    for (const id of this.getModuleIds()) {
      const normalized = id.replaceAll('\\', '/').split('?')[0];
      if (normalized.includes('/server/src/') && !['transfers/transfer-contract.ts', 'authors/authors.schemas.ts', 'books/books.schemas.ts', 'readings/readings.schemas.ts', 'readings/reading-period.schema.ts'].some(path => normalized.endsWith('/server/src/' + path))) {
        this.error(`Server runtime module in companion bundle: ${normalized}`);
      }
    }
  },

};
export default mergeConfig(base, defineConfig({
  plugins: [boundary],
  build: { outDir: 'dist-companion', rolldownOptions: { input: fileURLToPath(new URL('./companion.html', import.meta.url)) } },
}));
