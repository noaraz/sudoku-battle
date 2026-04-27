import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8001";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/ws": { target: BACKEND.replace(/^http/, "ws"), ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
