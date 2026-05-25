/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['@strudel/core', '@strudel/webaudio', '@strudel/mini', '@strudel/tonal'],
  },
  optimizeDeps: {
    include: ['@strudel/web', '@strudel/soundfonts'],
  },
  test: {
    environment: 'jsdom' as const,
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
} as any)
