export function shouldAbortOffTrack(offTrackSeconds: number, threshold: number): boolean {
  return offTrackSeconds > threshold
}

export function shouldAbortStuck(
  speedMS: number,
  stuckTimerSec: number,
  distFromGridSq: number,
  gridRadiusSq: number,
): boolean {
  const isMoving = speedMS >= 5
  if (isMoving) return false
  if (stuckTimerSec <= 5) return false
  return distFromGridSq > gridRadiusSq
}

export function shouldAbortTimeout(elapsedMs: number, maxSeconds: number): boolean {
  return elapsedMs > maxSeconds * 1000
}

export function isValidationLapComplete(
  lapStartedAt: number,
  validationStartedAt: number,
  lastLapTime: number | null,
): boolean {
  if (lastLapTime === null) return false
  return lapStartedAt >= validationStartedAt
}
