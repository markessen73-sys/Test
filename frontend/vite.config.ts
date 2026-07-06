import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

let gitSha = 'dev'
try {
  gitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
} catch {
  /* not a git repo */
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_GIT_SHA__: JSON.stringify(gitSha),
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
