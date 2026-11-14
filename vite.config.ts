import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// index.html doubles as the downloadable, standalone game. Vite always uses
// the editable source template so development and production share one UI.
export default defineConfig({
  plugins: [{
    name: 'morti-source-template',
    transformIndexHtml: {
      order: 'pre',
      handler: () => readFileSync(new URL('./src/page.html', import.meta.url), 'utf8'),
    },
  }],
});
