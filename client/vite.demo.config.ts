import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.ts';

export default mergeConfig(base, defineConfig({
  base: './',
  plugins: [{
    name: 'demo-index',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['demo.html'];
      if (html?.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: 'index.html', source: html.source });
        delete bundle['demo.html'];
      }
    },
  }],
  build: {
    outDir: 'dist-demo',
    rolldownOptions: { input: fileURLToPath(new URL('./demo.html', import.meta.url)) },
  },
}));
