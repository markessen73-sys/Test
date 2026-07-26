import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generate as generateCharacterManifest } from './scripts/generate-character-asset-manifest.mjs'

function currentGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

function buildInfoPayload() {
  return JSON.stringify({
    sha: currentGitSha(),
    builtAt: new Date().toISOString(),
  })
}

function buildInfoPlugin(): Plugin {
  return {
    name: 'build-info',
    configureServer(server) {
      generateCharacterManifest()
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/build-info.json') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.end(buildInfoPayload())
          return
        }
        next()
      })
    },
    buildStart() {
      generateCharacterManifest()
      writeFileSync(resolve(__dirname, 'public/build-info.json'), buildInfoPayload())
    },
  }
}

const gitSha = currentGitSha()

export default defineConfig({
  base: './',
  plugins: [react(), buildInfoPlugin()],
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
