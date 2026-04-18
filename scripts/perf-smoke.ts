#!/usr/bin/env bun
/**
 * Headless perf smoke runner.
 *
 * Without a real GPU/WASM environment under Bun we can only validate
 * the PerfScenarioRecorder contract and assert that a synthetic frame
 * stream drops out the expected FPS envelope. When the browser harness
 * becomes available, extend this script to spawn Playwright and drive
 * `window.__startPerfScenario` / `__stopPerfScenario`.
 */

import { PerfScenarioRecorder, formatMetrics } from '../src/debug/perfScenarios'

interface Budget {
  averageFpsMin: number
  onePercentLowMin: number
  wasmCallsPerFrameMax: number
}

const BUDGETS: Record<string, Budget> = {
  static_car: { averageFpsMin: 115, onePercentLowMin: 100, wasmCallsPerFrameMax: 2 },
  single_car_hotlap: { averageFpsMin: 108, onePercentLowMin: 90, wasmCallsPerFrameMax: 2 },
  twenty_car_grid: { averageFpsMin: 90, onePercentLowMin: 70, wasmCallsPerFrameMax: 4 },
}

function simulate(frameMs: number, frames: number, wasmCalls: number, gpu: number) {
  const r = new PerfScenarioRecorder('static_car')
  r.start()
  for (let i = 0; i < frames; i++) {
    r.record(frameMs / 1000, wasmCalls, gpu)
  }
  return r.stop()
}

const metrics = simulate(8.1, 600, 1, 2)
const budget = BUDGETS.static_car

const failures: string[] = []
if (metrics.averageFps < budget.averageFpsMin) {
  failures.push(`averageFps ${metrics.averageFps} < ${budget.averageFpsMin}`)
}
if (metrics.onePercentLowFps < budget.onePercentLowMin) {
  failures.push(`onePercentLowFps ${metrics.onePercentLowFps} < ${budget.onePercentLowMin}`)
}
if (metrics.wasmCallsPerFrame > budget.wasmCallsPerFrameMax) {
  failures.push(`wasmCallsPerFrame ${metrics.wasmCallsPerFrame} > ${budget.wasmCallsPerFrameMax}`)
}

console.log(formatMetrics(metrics))

if (failures.length > 0) {
  console.error('\nPERF SMOKE FAILED:')
  for (const f of failures) console.error('  - ' + f)
  process.exit(1)
}

console.log('\nPERF SMOKE PASSED')
