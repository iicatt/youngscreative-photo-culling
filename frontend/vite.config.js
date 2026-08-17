import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/proxy': {
        target: process.env.VITE_PROXY_INTERNAL_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
