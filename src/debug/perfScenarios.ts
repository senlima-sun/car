export type PerfScenarioId = 'static_car' | 'single_car_hotlap' | 'twenty_car_grid'

export interface PerfSample {
  frameDelta: number
  wasmCallCount: number
  gpuUploadCount: number
  timestampMs: number
}

export interface PerfMetricsBlob {
  scenario: PerfScenarioId
  label: string
  capturedAt: number
  durationMs: number
  frameCount: number
  averageFrameMs: number
  medianFrameMs: number
  onePercentLowFps: number
  pointOnePercentLowFps: number
  averageFps: number
  frameVarianceMs2: number
  wasmCallsPerFrame: number
  gpuUploadsPerFrame: number
}

export interface PerfScenarioDefinition {
  id: PerfScenarioId
  label: string
  description: string
  durationSeconds: number
}

export const PERF_SCENARIOS: Record<PerfScenarioId, PerfScenarioDefinition> = {
  static_car: {
    id: 'static_car',
    label: 'Static Car',
    description: 'Idle at pit exit. Baseline for render churn.',
    durationSeconds: 5,
  },
  single_car_hotlap: {
    id: 'single_car_hotlap',
    label: 'Single-Car Hot Lap',
    description: 'Full throttle around the reference track alone.',
    durationSeconds: 20,
  },
  twenty_car_grid: {
    id: 'twenty_car_grid',
    label: '20-Car Grid',
    description: 'AI + player on the reference track (phase 4+).',
    durationSeconds: 20,
  },
}

const MAX_SAMPLES = 8192

export class PerfScenarioRecorder {
  private id: PerfScenarioId
  private samples: PerfSample[] = []
  private startWallMs = 0
  private running = false
  private wasmCountsAccum = 0
  private gpuUploadsAccum = 0

  constructor(id: PerfScenarioId) {
    this.id = id
  }

  start(): void {
    this.samples = []
    this.startWallMs = performance.now()
    this.running = true
    this.wasmCountsAccum = 0
    this.gpuUploadsAccum = 0
  }

  record(frameDelta: number, wasmCalls: number, gpuUploads: number): void {
    if (!this.running) return
    if (this.samples.length >= MAX_SAMPLES) return
    this.wasmCountsAccum += wasmCalls
    this.gpuUploadsAccum += gpuUploads
    this.samples.push({
      frameDelta,
      wasmCallCount: wasmCalls,
      gpuUploadCount: gpuUploads,
      timestampMs: performance.now() - this.startWallMs,
    })
  }

  stop(): PerfMetricsBlob {
    this.running = false
    return summarize(this.id, this.samples, this.wasmCountsAccum, this.gpuUploadsAccum)
  }

  isRunning(): boolean {
    return this.running
  }
}

function summarize(
  id: PerfScenarioId,
  samples: PerfSample[],
  wasmCallsTotal: number,
  gpuUploadsTotal: number,
): PerfMetricsBlob {
  const scenario = PERF_SCENARIOS[id]
  const frameCount = samples.length
  if (frameCount === 0) {
    return {
      scenario: id,
      label: scenario.label,
      capturedAt: Date.now(),
      durationMs: 0,
      frameCount: 0,
      averageFrameMs: 0,
      medianFrameMs: 0,
      onePercentLowFps: 0,
      pointOnePercentLowFps: 0,
      averageFps: 0,
      frameVarianceMs2: 0,
      wasmCallsPerFrame: 0,
      gpuUploadsPerFrame: 0,
    }
  }

  const frameMs = samples.map(s => s.frameDelta * 1000)
  const sorted = [...frameMs].sort((a, b) => a - b)
  const mean = frameMs.reduce((s, v) => s + v, 0) / frameCount
  const median = sorted[Math.floor(sorted.length / 2)]
  const variance = frameMs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / frameCount

  const onePercentIdx = Math.max(0, Math.floor(sorted.length * 0.99) - 1)
  const pointOnePercentIdx = Math.max(0, Math.floor(sorted.length * 0.999) - 1)
  const worstAt = (idx: number) => (sorted[idx] > 0 ? 1000 / sorted[idx] : 0)

  return {
    scenario: id,
    label: scenario.label,
    capturedAt: Date.now(),
    durationMs: samples[samples.length - 1].timestampMs,
    frameCount,
    averageFrameMs: round(mean, 3),
    medianFrameMs: round(median, 3),
    onePercentLowFps: round(worstAt(onePercentIdx), 1),
    pointOnePercentLowFps: round(worstAt(pointOnePercentIdx), 1),
    averageFps: round(mean > 0 ? 1000 / mean : 0, 1),
    frameVarianceMs2: round(variance, 4),
    wasmCallsPerFrame: round(wasmCallsTotal / frameCount, 3),
    gpuUploadsPerFrame: round(gpuUploadsTotal / frameCount, 3),
  }
}

function round(v: number, digits: number): number {
  const mult = Math.pow(10, digits)
  return Math.round(v * mult) / mult
}

export function formatMetrics(metrics: PerfMetricsBlob): string {
  return [
    `# ${metrics.label} (${metrics.scenario})`,
    `capturedAt: ${new Date(metrics.capturedAt).toISOString()}`,
    `duration: ${metrics.durationMs.toFixed(0)}ms / frames: ${metrics.frameCount}`,
    `avg: ${metrics.averageFrameMs.toFixed(2)}ms (${metrics.averageFps} fps)`,
    `median: ${metrics.medianFrameMs.toFixed(2)}ms`,
    `1% low: ${metrics.onePercentLowFps} fps, 0.1% low: ${metrics.pointOnePercentLowFps} fps`,
    `variance: ${metrics.frameVarianceMs2.toFixed(3)} ms^2`,
    `wasm calls/frame: ${metrics.wasmCallsPerFrame}`,
    `gpu uploads/frame: ${metrics.gpuUploadsPerFrame}`,
  ].join('\n')
}
