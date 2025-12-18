// Road snapping utility functions for angle and tangent-aware snapping

export interface SnapSettings {
  angleSnap: boolean
  angleIncrements: number[] // in degrees, e.g., [15, 30, 45, 90]
  tangentSnap: boolean
}

export interface AngleSnapResult {
  position: [number, number, number]
  angle: number // in radians
  snapped: boolean
}

export interface SnapResult {
  position: [number, number, number]
  snappedAngle: number | null // radians, null if no angle snap
  isTangentAligned: boolean
}

// Default snap settings
export const DEFAULT_SNAP_SETTINGS: SnapSettings = {
  angleSnap: true,
  angleIncrements: [15, 30, 45, 90],
  tangentSnap: true,
}

// Angle snap threshold in radians (5 degrees)
const ANGLE_SNAP_THRESHOLD = (5 * Math.PI) / 180

// Normalize angle to [-PI, PI]
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

/**
 * Find the nearest snap angle from the given increments
 * Returns null if no angle is within the snap threshold
 */
export function findAngleSnap(
  rawPosition: [number, number, number],
  startPoint: [number, number, number],
  increments: number[], // in degrees
): AngleSnapResult | null {
  const dx = rawPosition[0] - startPoint[0]
  const dz = rawPosition[2] - startPoint[2]
  const distance = Math.sqrt(dx * dx + dz * dz)

  if (distance < 0.1) return null

  // Current angle in radians (using atan2(x, z) for Three.js coordinate system)
  const currentAngle = Math.atan2(dx, dz)

  let bestAngle = currentAngle
  let bestDiff = Infinity

  // Check all increment angles
  for (const deg of increments) {
    const incrementRad = (deg * Math.PI) / 180
    const numSteps = Math.ceil(360 / deg)

    for (let i = 0; i < numSteps; i++) {
      // Generate snap angles from -PI to PI
      const snapAngle = normalizeAngle(i * incrementRad - Math.PI)
      const diff = Math.abs(normalizeAngle(currentAngle - snapAngle))

      if (diff < bestDiff) {
        bestDiff = diff
        bestAngle = snapAngle
      }
    }
  }

  // Only snap if within threshold
  if (bestDiff > ANGLE_SNAP_THRESHOLD) {
    return null
  }

  // Calculate snapped position at the same distance
  const snappedX = startPoint[0] + Math.sin(bestAngle) * distance
  const snappedZ = startPoint[2] + Math.cos(bestAngle) * distance

  return {
    position: [snappedX, 0, snappedZ],
    angle: bestAngle,
    snapped: true,
  }
}

/**
 * Project cursor position along a tangent direction from start point
 * Used when connecting to an existing road to maintain G1 continuity
 */
export function findTangentSnap(
  rawPosition: [number, number, number],
  startPoint: [number, number, number],
  tangentDirection: [number, number, number],
): [number, number, number] {
  // Normalize tangent
  const tanLen = Math.sqrt(
    tangentDirection[0] * tangentDirection[0] + tangentDirection[2] * tangentDirection[2],
  )
  if (tanLen < 0.001) return rawPosition

  const normTangent: [number, number, number] = [
    tangentDirection[0] / tanLen,
    0,
    tangentDirection[2] / tanLen,
  ]

  // Vector from start to cursor
  const dx = rawPosition[0] - startPoint[0]
  const dz = rawPosition[2] - startPoint[2]

  // Project onto tangent direction (dot product)
  const projection = dx * normTangent[0] + dz * normTangent[2]

  // Return position along tangent at projected distance
  // Only allow positive projection (forward along tangent)
  const clampedProjection = Math.max(projection, 0)

  return [
    startPoint[0] + normTangent[0] * clampedProjection,
    0,
    startPoint[2] + normTangent[2] * clampedProjection,
  ]
}

/**
 * Check if cursor position is aligned with a tangent direction
 * Returns true if within angle threshold
 */
export function isTangentAligned(
  rawPosition: [number, number, number],
  startPoint: [number, number, number],
  tangentDirection: [number, number, number],
  threshold: number = ANGLE_SNAP_THRESHOLD,
): boolean {
  const dx = rawPosition[0] - startPoint[0]
  const dz = rawPosition[2] - startPoint[2]
  const distance = Math.sqrt(dx * dx + dz * dz)

  if (distance < 0.1) return false

  // Normalize cursor direction
  const cursorDir: [number, number, number] = [dx / distance, 0, dz / distance]

  // Normalize tangent
  const tanLen = Math.sqrt(
    tangentDirection[0] * tangentDirection[0] + tangentDirection[2] * tangentDirection[2],
  )
  if (tanLen < 0.001) return false

  const normTangent: [number, number, number] = [
    tangentDirection[0] / tanLen,
    0,
    tangentDirection[2] / tanLen,
  ]

  // Check alignment via dot product (1 = aligned, -1 = opposite)
  const dot = cursorDir[0] * normTangent[0] + cursorDir[2] * normTangent[2]

  // Convert to angle and check threshold
  const angle = Math.acos(Math.min(1, Math.abs(dot)))
  return angle < threshold
}

/**
 * Combined snap calculation
 * Applies tangent snap first (if connected), then angle snap
 */
export function calculateSnappedPosition(
  rawPosition: [number, number, number],
  startPoint: [number, number, number] | null,
  connectedTangent: [number, number, number] | null,
  settings: SnapSettings,
): SnapResult {
  if (!startPoint) {
    return {
      position: rawPosition,
      snappedAngle: null,
      isTangentAligned: false,
    }
  }

  let workingPosition = rawPosition
  let tangentAligned = false

  // Step 1: If tangent snap enabled and we have a connected tangent, check alignment
  if (settings.tangentSnap && connectedTangent) {
    tangentAligned = isTangentAligned(rawPosition, startPoint, connectedTangent)

    if (tangentAligned) {
      // Snap to tangent direction
      workingPosition = findTangentSnap(rawPosition, startPoint, connectedTangent)
    }
  }

  // Step 2: Apply angle snapping
  if (settings.angleSnap) {
    const angleResult = findAngleSnap(workingPosition, startPoint, settings.angleIncrements)

    if (angleResult) {
      return {
        position: angleResult.position,
        snappedAngle: angleResult.angle,
        isTangentAligned: tangentAligned,
      }
    }
  }

  return {
    position: workingPosition,
    snappedAngle: null,
    isTangentAligned: tangentAligned,
  }
}

/**
 * Get all valid snap angles for visual guides
 * Returns angles in radians
 */
export function getSnapAngles(increments: number[]): number[] {
  const angles: Set<number> = new Set()

  for (const deg of increments) {
    const incrementRad = (deg * Math.PI) / 180
    const numSteps = Math.ceil(360 / deg)

    for (let i = 0; i < numSteps; i++) {
      const angle = normalizeAngle(i * incrementRad - Math.PI)
      // Round to avoid floating point duplicates
      angles.add(Math.round(angle * 1000) / 1000)
    }
  }

  return Array.from(angles).sort((a, b) => a - b)
}

/**
 * Calculate bezier tangent at t=0 or t=1
 * For quadratic bezier: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
 */
export function getBezierTangentAtEndpoint(
  P0: [number, number, number],
  P1: [number, number, number], // control point
  P2: [number, number, number],
  atStart: boolean,
): [number, number, number] {
  let tangent: [number, number, number]

  if (atStart) {
    // At t=0: B'(0) = 2(P1 - P0)
    tangent = [2 * (P1[0] - P0[0]), 0, 2 * (P1[2] - P0[2])]
  } else {
    // At t=1: B'(1) = 2(P2 - P1)
    tangent = [2 * (P2[0] - P1[0]), 0, 2 * (P2[2] - P1[2])]
  }

  // Normalize
  const len = Math.sqrt(tangent[0] * tangent[0] + tangent[2] * tangent[2])
  if (len < 0.001) return [0, 0, 1]

  return [tangent[0] / len, 0, tangent[2] / len]
}

/**
 * Calculate outward-pointing tangent for a road endpoint
 * For start point: points away from the road (opposite of road direction)
 * For end point: points away from the road (same as road direction)
 */
export function getOutwardTangent(
  startPoint: [number, number, number],
  endPoint: [number, number, number],
  controlPoint: [number, number, number] | undefined,
  atStart: boolean,
): [number, number, number] {
  if (controlPoint) {
    // Curved road - use bezier tangent
    const tangent = getBezierTangentAtEndpoint(startPoint, controlPoint, endPoint, atStart)
    // At start, negate to point outward (away from road)
    if (atStart) {
      return [-tangent[0], 0, -tangent[2]]
    }
    return tangent
  } else {
    // Straight road
    const dx = endPoint[0] - startPoint[0]
    const dz = endPoint[2] - startPoint[2]
    const len = Math.sqrt(dx * dx + dz * dz)

    if (len < 0.001) return [0, 0, 1]

    const dir: [number, number, number] = [dx / len, 0, dz / len]

    // At start, tangent points opposite to road direction (outward)
    // At end, tangent points same as road direction (outward)
    if (atStart) {
      return [-dir[0], 0, -dir[2]]
    }
    return dir
  }
}
