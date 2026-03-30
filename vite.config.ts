/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Rewrite /gm to dashboard.html in the dev server
function gmRewritePlugin() {
  return {
    name: 'gm-rewrite',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use((req: { url?: string }, _res: unknown, next: () => void) => {
        if (req.url === '/gm' || req.url?.startsWith('/gm?')) {
          req.url = '/dashboard.html'
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [gmRewritePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        dashboard: path.resolve(__dirname, 'dashboard.html'),
      },
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/ws': { target: 'ws://localhost:8765', ws: true },
      '/api': { target: 'http://localhost:8765' },
      '/genre': { target: 'http://localhost:8765' },
      '/renders': { target: 'http://localhost:8765' },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
})
