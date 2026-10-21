import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
// BASE_PATH is set by the GitHub Pages workflow. It keeps assets working when
// the site is hosted below https://<user>.github.io/<repository>/.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [tailwindcss()],
  build: { target: 'esnext' },
  worker: { format: 'es' },
  server: { host: '127.0.0.1' }
});

