import { watch } from 'fs'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import tailwind from 'bun-plugin-tailwind'

const PORT = 3000

// Ensure dist-dev directory exists
if (!existsSync('./dist-dev')) {
  mkdirSync('./dist-dev', { recursive: true })
}

// Build the application with development settings
async function buildApp(): Promise<boolean> {
  console.log('\x1b[36m[build]\x1b[0m Bundling...')
  const start = performance.now()

  const result = await Bun.build({
    entrypoints: ['./src/main.tsx'],
    outdir: './dist-dev',
    target: 'browser',
    minify: false,
    sourcemap: 'inline',
    splitting: true,
    plugins: [tailwind],
    define: {
      'import.meta.env.VITE_PUBLIC_POSTHOG_HOST': JSON.stringify(process.env.POSTHOG_HOST || ''),
      'import.meta.env.VITE_PUBLIC_POSTHOG_KEY': JSON.stringify(process.env.POSTHOG_KEY || ''),
      'import.meta.env.DEV': 'true',
      'import.meta.env.PROD': 'false',
      'import.meta.env.MODE': '"development"',
    },
  })

  if (!result.success) {
    console.error('\x1b[31m[build]\x1b[0m Build failed:')
    for (const log of result.logs) {
      console.error(log)
    }
    return false
  }

  // Find main entry and CSS output, generate index.html
  const mainOutput = result.outputs.find(o => o.kind === 'entry-point' && o.path.includes('main'))
  const mainFileName = mainOutput?.path.split('/').pop() || 'main.js'
  const cssOutput = result.outputs.find(o => o.path.endsWith('.css'))
  const cssFileName = cssOutput?.path.split('/').pop()

  const devHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>3D Car Racing Game - Dev</title>
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />${
      cssFileName
        ? `
    <link rel="stylesheet" href="/${cssFileName}" />`
        : ''
    }
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${mainFileName}"></script>
  </body>
</html>`

  await Bun.write('./dist-dev/index.html', devHtml)

  const elapsed = (performance.now() - start).toFixed(0)
  console.log(`\x1b[32m[build]\x1b[0m Done in ${elapsed}ms`)
  return true
}

// Initial build
const initialBuild = await buildApp()
if (!initialBuild) {
  console.error('Initial build failed, exiting')
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
}

function getMimeType(path: string): string {
  const ext = '.' + path.split('.').pop()?.toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

// File watcher with debouncing
let rebuildTimeout: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 100

function scheduleRebuild() {
  if (rebuildTimeout) {
    clearTimeout(rebuildTimeout)
  }
  rebuildTimeout = setTimeout(() => {
    buildApp()
    rebuildTimeout = null
  }, DEBOUNCE_MS)
}

// Watch src directory for changes
const srcWatcher = watch('./src', { recursive: true }, (event, filename) => {
  if (filename && !filename.includes('wasm/pkg')) {
    console.log(`\x1b[33m[watch]\x1b[0m ${event}: ${filename}`)
    scheduleRebuild()
  }
})

console.log('\x1b[33m[watch]\x1b[0m Watching src/ for changes...')

// Start the server
// @ts-ignore
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    let pathname = url.pathname

    // Handle root
    if (pathname === '/') {
      pathname = '/index.html'
    }

    // Try to serve from dist-dev first (built files)
    const distPath = join('./dist-dev', pathname)
    let file = Bun.file(distPath)

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          'Content-Type': getMimeType(pathname),
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Try to serve from public folder
    const publicPath = join('./public', pathname)
    file = Bun.file(publicPath)

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          'Content-Type': getMimeType(pathname),
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Try to serve WASM files from src/wasm/pkg
    if (pathname.endsWith('.wasm')) {
      const wasmFileName = pathname.split('/').pop()
      const wasmPath = join('./src/wasm/pkg', wasmFileName || '')
      file = Bun.file(wasmPath)

      if (await file.exists()) {
        return new Response(file, {
          headers: {
            'Content-Type': 'application/wasm',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          },
        })
      }
    }

    // SPA fallback - return index.html
    const indexFile = Bun.file('./dist-dev/index.html')
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
\x1b[32m  Dev server running at:\x1b[0m http://localhost:${PORT}

  \x1b[90mChanges to src/ will trigger automatic rebuilds.
  Refresh the browser to see changes.\x1b[0m
`)

// Cleanup on exit
process.on('SIGINT', () => {
  srcWatcher.close()
  console.log('\n\x1b[33m[server]\x1b[0m Shutting down...')
  process.exit(0)
})
