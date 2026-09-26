import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: 'localhost', port: 5175, strictPort: true, allowedHosts: ['.up.karenko.fi'] },
});
