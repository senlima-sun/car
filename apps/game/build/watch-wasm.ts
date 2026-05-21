/**
 * Watch Rust files and rebuild WASM on changes
 */

import { watch } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PHYSICS_ENGINE_DIR = join(HERE, '../../../physics-engine/src')
const PHYSICS_ENGINE_ROOT = join(HERE, '../../../physics-engine')
const DEBOUNCE_MS = 500

let buildTimeout: ReturnType<typeof setTimeout> | null = null
let isBuilding = false

async function buildWasm() {
  if (isBuilding) {
    console.log('[WASM Watch] Build already in progress, skipping...')
    return
  }

  isBuilding = true
  console.log('\n[WASM Watch] Rust files changed, rebuilding WASM...')

  try {
    const proc = spawn(
      'wasm-pack',
      ['build', '--target', 'web', '--out-dir', '../packages/physics/pkg'],
      { cwd: PHYSICS_ENGINE_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    )

    let stderr = ''
    proc.stderr?.on('data', chunk => {
      stderr += chunk.toString()
    })

    const exitCode = await new Promise<number>(resolve => {
      proc.on('exit', code => resolve(code ?? 1))
    })

    if (exitCode === 0) {
      console.log('[WASM Watch] WASM build successful!')
    } else {
      console.error('[WASM Watch] WASM build failed:')
      console.error(stderr)
    }
  } catch (error) {
    console.error('[WASM Watch] Build error:', error)
  } finally {
    isBuilding = false
  }
}

function debouncedBuild() {
  if (buildTimeout) {
    clearTimeout(buildTimeout)
  }
  buildTimeout = setTimeout(buildWasm, DEBOUNCE_MS)
}

console.log(`[WASM Watch] Watching ${PHYSICS_ENGINE_DIR} for changes...`)

watch(PHYSICS_ENGINE_DIR, { recursive: true }, (_event, filename) => {
  if (filename && filename.endsWith('.rs')) {
    console.log(`[WASM Watch] Detected change in ${filename}`)
    debouncedBuild()
  }
})

process.on('SIGINT', () => {
  console.log('\n[WASM Watch] Shutting down...')
  process.exit(0)
})
