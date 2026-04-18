export const TELEMETRY_SCHEMA_VERSION = 1

/** Fields every lap trace must carry. Keep append-only for backward compat. */
export interface TelemetryFrame {
  /** Milliseconds from lap start. */
  tMs: number
  speedMs: number
  throttle: number
  brake: number
  steer: number
  gear: number
  rpm: number
  position: [number, number, number]
  /** Percentage 0..1 */
  tireWearFront: number
  tireWearRear: number
  /** Battery charge 0..1 */
  ersCharge: number
  /** Flag code: 0 green, 1 yellow, 2 red, 3 checkered, 4 vsc, 5 sc */
  flag: number
  /** Whether this frame is part of an invalid lap. */
  invalid: boolean
}

export interface LapTrace {
  schemaVersion: number
  trackId: string
  lapNumber: number
  lapTimeMs: number | null
  setupId: string | null
  frames: TelemetryFrame[]
  capturedAt: number
}

export const EMPTY_FRAME: TelemetryFrame = {
  tMs: 0,
  speedMs: 0,
  throttle: 0,
  brake: 0,
  steer: 0,
  gear: 0,
  rpm: 0,
  position: [0, 0, 0],
  tireWearFront: 0,
  tireWearRear: 0,
  ersCharge: 0,
  flag: 0,
  invalid: false,
}
