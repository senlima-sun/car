import { spawn } from 'bun'
import { mkdir, rm, cp } from 'fs/promises'
import { existsSync } from 'fs'
import { join, resolve } from 'path'
import tailwind from 'bun-plugin-tailwind'

const ROOT_DIR = resolve(import.meta.dir, '..')
const DIST_DIR = join(ROOT_DIR, 'dist')
const PUBLIC_DIR = join(ROOT_DIR, 'public')
const WASM_PKG_DIR = join(ROOT_DIR, 'src/wasm/pkg')
const WASM_DIST_DIR = join(DIST_DIR, 'src/wasm/pkg')

async function runWasmBuild(): Promise<void> {
  console.log('[Build] Compiling WASM (release)...')
  const proc = spawn({
    cmd: [
      'wasm-pack',
      'build',
      '--target',
      'web',
      '--out-dir',
      '../src/wasm/pkg',
      '--release',
    ],
    cwd: join(ROOT_DIR, 'physics-engine'),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`wasm-pack exited with code ${code}`)
  }
}

async function cleanDist(): Promise<void> {
  if (existsSync(DIST_DIR)) {
    await rm(DIST_DIR, { recursive: true, force: true })
  }
  await mkdir(DIST_DIR, { recursive: true })
}

async function bundleApp(): Promise<void> {
  console.log('[Build] Bundling frontend with bun-plugin-tailwind...')
  const result = await Bun.build({
    entrypoints: [join(ROOT_DIR, 'index.html')],
    outdir: DIST_DIR,
    target: 'browser',
    minify: true,
    splitting: true,
    sourcemap: 'linked',
    plugins: [tailwind],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  })
  if (!result.success) {
    for (const msg of result.logs) console.error(msg)
    throw new Error('Bun.build failed')
  }
  for (const out of result.outputs) {
    const kb = (out.size / 1024).toFixed(2)
    console.log(`  ${out.kind.padEnd(10)} ${kb.padStart(10)} KB  ${out.path.replace(ROOT_DIR + '/', '')}`)
  }
}

async function copyPublicAssets(): Promise<void> {
  console.log('[Build] Copying public assets...')
  await cp(PUBLIC_DIR, DIST_DIR, { recursive: true })
}

async function copyWasmPackage(): Promise<void> {
  console.log('[Build] Copying wasm-pack output (js + wasm)...')
  await mkdir(WASM_DIST_DIR, { recursive: true })
  await cp(WASM_PKG_DIR, WASM_DIST_DIR, { recursive: true })
}

const start = performance.now()
await cleanDist()
await runWasmBuild()
await bundleApp()
await copyPublicAssets()
await copyWasmPackage()
const elapsed = ((performance.now() - start) / 1000).toFixed(2)
console.log(`[Build] Done in ${elapsed}s -> ${DIST_DIR}`)
