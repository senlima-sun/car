/**
 * Watch Rust files and rebuild WASM on changes
 */

import { watch } from 'fs'
import { spawn } from 'bun'
import { join } from 'path'

const PHYSICS_ENGINE_DIR = join(import.meta.dir, '../physics-engine/src')
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
    const proc = spawn({
      cmd: ['wasm-pack', 'build', '--target', 'web', '--out-dir', '../src/wasm/pkg'],
      cwd: join(import.meta.dir, '../physics-engine'),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited

    if (exitCode === 0) {
      console.log('[WASM Watch] WASM build successful!')
    } else {
      const stderr = await new Response(proc.stderr).text()
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

// Watch for changes in physics-engine/src
console.log(`[WASM Watch] Watching ${PHYSICS_ENGINE_DIR} for changes...`)

watch(PHYSICS_ENGINE_DIR, { recursive: true }, filename => {
  if (filename && filename.endsWith('.rs')) {
    console.log(`[WASM Watch] Detected change in ${filename}`)
    debouncedBuild()
  }
})

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n[WASM Watch] Shutting down...')
  process.exit(0)
})
