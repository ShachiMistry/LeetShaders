import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        manual: resolve(__dirname, 'src/judge/test/manual.html'),
      },
    },
  },
});
