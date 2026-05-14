type PerfHook = (delta: number) => void

let perfHook: PerfHook = () => {}

export function setPerfHook(fn: PerfHook): void {
  perfHook = fn
}

export function emitWasmCall(): void {
  perfHook(1)
}
