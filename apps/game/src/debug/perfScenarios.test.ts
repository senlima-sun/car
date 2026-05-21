import { describe, expect, test } from 'vitest'
import { PerfScenarioRecorder, formatMetrics } from './perfScenarios'

describe('PerfScenarioRecorder', () => {
  test('empty scenario produces zeroed metrics', () => {
    const r = new PerfScenarioRecorder('static_car')
    r.start()
    const m = r.stop()
    expect(m.frameCount).toBe(0)
    expect(m.averageFrameMs).toBe(0)
    expect(m.averageFps).toBe(0)
  })

  test('records and aggregates frame samples', () => {
    const r = new PerfScenarioRecorder('single_car_hotlap')
    r.start()
    for (let i = 0; i < 50; i++) {
      r.record(1 / 120, 1, 0)
    }
    for (let i = 0; i < 50; i++) {
      r.record(1 / 60, 1, 1)
    }
    const m = r.stop()
    expect(m.frameCount).toBe(100)
    expect(m.averageFps).toBeGreaterThan(70)
    expect(m.averageFps).toBeLessThan(120)
    expect(m.wasmCallsPerFrame).toBe(1)
    expect(m.gpuUploadsPerFrame).toBeCloseTo(0.5, 1)
  })

  test('isRunning transitions correctly', () => {
    const r = new PerfScenarioRecorder('static_car')
    expect(r.isRunning()).toBe(false)
    r.start()
    expect(r.isRunning()).toBe(true)
    r.stop()
    expect(r.isRunning()).toBe(false)
  })

  test('formatMetrics yields human-readable output', () => {
    const r = new PerfScenarioRecorder('static_car')
    r.start()
    for (let i = 0; i < 10; i++) r.record(1 / 120, 2, 3)
    const text = formatMetrics(r.stop())
    expect(text).toContain('Static Car')
    expect(text).toContain('avg:')
    expect(text).toContain('wasm calls/frame: 2')
  })
})
