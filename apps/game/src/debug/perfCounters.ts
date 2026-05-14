let wasmCalls = 0
let gpuUploads = 0

export function incrementWasmCalls(n = 1): void {
  wasmCalls += n
}

export function incrementGpuUploads(n = 1): void {
  gpuUploads += n
}

export function readAndResetPerFrameCounters(): { wasmCalls: number; gpuUploads: number } {
  const w = wasmCalls
  const g = gpuUploads
  wasmCalls = 0
  gpuUploads = 0
  return { wasmCalls: w, gpuUploads: g }
}
