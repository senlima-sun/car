import { join } from 'path'
import { existsSync } from 'fs'

const PORT = 4173
const DIST_DIR = './dist'

// Check if dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error('\x1b[31mError:\x1b[0m dist/ directory not found. Run `bun run build` first.')
  process.exit(1)
}

// MIME types
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.map': 'application/json',
}

function getMimeType(path: string): string {
  const ext = '.' + path.split('.').pop()?.toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    let pathname = url.pathname

    // Handle root
    if (pathname === '/') {
      pathname = '/index.html'
    }

    // Try to serve from dist
    const filePath = join(DIST_DIR, pathname)
    const file = Bun.file(filePath)

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          'Content-Type': getMimeType(pathname),
          'Cache-Control': pathname.includes('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        },
      })
    }

    // SPA fallback - return index.html for client-side routing
    const indexFile = Bun.file(join(DIST_DIR, 'index.html'))
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache',
        },
      })
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`
\x1b[32m  Preview server running at:\x1b[0m http://localhost:${PORT}

  \x1b[90mServing production build from dist/\x1b[0m
`)
