/**
 * Development script that runs:
 * 1. WASM build (initial)
 * 2. Dev server
 * 3. WASM watcher (rebuilds on Rust file changes)
 */

import { spawn, type Subprocess } from 'bun'
import { join } from 'path'

const ROOT_DIR = join(import.meta.dir, '..')

// Track child processes for cleanup
const processes: Subprocess[] = []

async function buildWasmInitial(): Promise<boolean> {
  console.log('[Dev] Building WASM...')

  const proc = spawn({
    cmd: ['wasm-pack', 'build', '--target', 'web', '--out-dir', '../src/wasm/pkg'],
    cwd: join(ROOT_DIR, 'physics-engine'),
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    console.error('[Dev] Initial WASM build failed!')
    return false
  }

  console.log('[Dev] Initial WASM build complete')
  return true
}

function startDevServer(): Subprocess {
  console.log('[Dev] Starting dev server...')

  const proc = spawn({
    cmd: ['bun', 'run', 'build/dev-server.ts'],
    cwd: ROOT_DIR,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  processes.push(proc)
  return proc
}

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

  for (const proc of processes) {
    try {
      proc.kill()
    } catch (e) {
      // Process may already be dead
    }
  }

  process.exit(0)
}

// Handle cleanup on exit
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

// Main
async function main() {
  // 1. Build WASM first
  const buildSuccess = await buildWasmInitial()
  if (!buildSuccess) {
    process.exit(1)
  }

  // 2. Start dev server and WASM watcher concurrently
  const server = startDevServer()
  const watcher = startWasmWatcher()

  // Wait for either to exit (shouldn't happen normally)
  await Promise.race([server.exited, watcher.exited])

  cleanup()
}

main().catch(console.error)
