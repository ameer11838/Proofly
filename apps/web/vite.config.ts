import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API allows exactly one origin (WEB_ORIGIN). Silently falling back to
    // 5174 when 5173 is taken turns a busy port into an opaque CORS failure at
    // the first fetch, so fail here instead.
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
});
