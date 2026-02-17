let yawOffset = 0
let pitchOffset = 0
let pointerLocked = false
let sensitivity = 0.002

const MAX_YAW = (120 * Math.PI) / 180
const MAX_PITCH = (30 * Math.PI) / 180

export function getLookYaw(): number {
  return yawOffset
}

export function getLookPitch(): number {
  return pitchOffset
}

export function isPointerLocked(): boolean {
  return pointerLocked
}

export function setPointerLocked(locked: boolean): void {
  pointerLocked = locked
}

export function setLookSensitivity(value: number): void {
  sensitivity = value
}

export function handleLookMouseMove(e: MouseEvent): void {
  if (!pointerLocked) return
  yawOffset -= e.movementX * sensitivity
  yawOffset = Math.max(-MAX_YAW, Math.min(MAX_YAW, yawOffset))
  pitchOffset -= e.movementY * sensitivity
  pitchOffset = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitchOffset))
}

export function resetLookState(): void {
  yawOffset = 0
  pitchOffset = 0
}
