import { spawn, serve, type Subprocess } from 'bun'
import { statSync } from 'fs'
import { join, resolve, extname } from 'path'

const MIN_BUN_MAJOR = 1
const MIN_BUN_MINOR = 2

const [major, minor] = Bun.version.split('.').map(n => parseInt(n, 10))
if (major < MIN_BUN_MAJOR || (major === MIN_BUN_MAJOR && minor < MIN_BUN_MINOR)) {
  console.error(
    `[Dev] Bun ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR}+ required for HMR + React Fast Refresh. Current: ${Bun.version}`,
  )
  process.exit(1)
}

const ROOT_DIR = resolve(import.meta.dir, '..')
const PUBLIC_DIR = join(ROOT_DIR, 'public')

const STATIC_PREFIXES: Array<{ urlPrefix: string; diskRoot: string }> = [
  { urlPrefix: '/textures/', diskRoot: PUBLIC_DIR },
  { urlPrefix: '/models/', diskRoot: PUBLIC_DIR },
  { urlPrefix: '/src/wasm/pkg/', diskRoot: ROOT_DIR },
]

const STATIC_FILES: Record<string, string> = {
  '/favicon.ico': join(PUBLIC_DIR, 'favicon.ico'),
  '/sw.js': join(PUBLIC_DIR, 'sw.js'),
}

const MIME: Record<string, string> = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.css': 'text/css',
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.map': 'application/json',
}

function serveFileFromDisk(absPath: string): Response | null {
  try {
    const stats = statSync(absPath)
    if (!stats.isFile()) return null
    const file = Bun.file(absPath)
    const type = MIME[extname(absPath).toLowerCase()] ?? 'application/octet-stream'
    return new Response(file, { headers: { 'Content-Type': type } })
  } catch {
    return null
  }
}

function isSafeChild(parent: string, child: string): boolean {
  const parentAbs = resolve(parent) + '/'
  const childAbs = resolve(child)
  return childAbs.startsWith(parentAbs)
}

async function buildWasmInitial(): Promise<boolean> {
  console.log('[Dev] Building WASM...')
  const proc = spawn({
    cmd: ['wasm-pack', 'build', '--target', 'web', '--out-dir', '../src/wasm/pkg'],
    cwd: join(ROOT_DIR, 'physics-engine'),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  if (code !== 0) {
    console.error('[Dev] Initial WASM build failed')
    return false
  }
  console.log('[Dev] Initial WASM build complete')
  return true
}

const processes: Subprocess[] = []

function startWasmWatcher(): Subprocess {
  console.log('[Dev] Starting WASM watcher...')
  const proc = spawn({
    cmd: ['bun', 'run', 'build/watch-wasm.ts'],
    cwd: ROOT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  processes.push(proc)
  return proc
}

function cleanup() {
  console.log('\n[Dev] Shutting down...')
  for (const p of processes) {
    try {
      p.kill()
    } catch {}
  }
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

const ok = await buildWasmInitial()
if (!ok) process.exit(1)

startWasmWatcher()

import index from '../index.html'

const port = parseInt(process.env.PORT ?? '3000', 10)

const server = serve({
  port,
  development: {
    hmr: true,
    console: true,
  },
  routes: {
    '/': index,
  },
  fetch(req) {
    const url = new URL(req.url)
    const pathname = decodeURIComponent(url.pathname)

    const fixed = STATIC_FILES[pathname]
    if (fixed) {
      const res = serveFileFromDisk(fixed)
      if (res) return res
    }

    for (const { urlPrefix, diskRoot } of STATIC_PREFIXES) {
      if (pathname.startsWith(urlPrefix)) {
        const abs = join(diskRoot, pathname)
        if (!isSafeChild(diskRoot, abs)) {
          return new Response('Forbidden', { status: 403 })
        }
        const res = serveFileFromDisk(abs)
        if (res) return res
        return new Response('Not Found', { status: 404 })
      }
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`[Dev] Server running at ${server.url}`)
