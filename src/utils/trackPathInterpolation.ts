import type { TrackPath } from '@/types/trackPath'

export function evaluateCubicBezier(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  t: number,
): [number, number] {
  const t1 = 1 - t
  const t12 = t1 * t1
  const t13 = t12 * t1
  const t2 = t * t
  const t3 = t2 * t
  return [
    t13 * P0[0] + 3 * t12 * t * P1[0] + 3 * t1 * t2 * P2[0] + t3 * P3[0],
    t13 * P0[1] + 3 * t12 * t * P1[1] + 3 * t1 * t2 * P2[1] + t3 * P3[1],
  ]
}

export function evaluateCubicBezierDerivative(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  t: number,
): [number, number] {
  const t1 = 1 - t
  return [
    3 * t1 * t1 * (P1[0] - P0[0]) + 6 * t1 * t * (P2[0] - P1[0]) + 3 * t * t * (P3[0] - P2[0]),
    3 * t1 * t1 * (P1[1] - P0[1]) + 6 * t1 * t * (P2[1] - P1[1]) + 3 * t * t * (P3[1] - P2[1]),
  ]
}

export function cubicBezierCurvature(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  t: number,
): number {
  const d1 = evaluateCubicBezierDerivative(P0, P1, P2, P3, t)
  const t1 = 1 - t
  const d2x = 6 * t1 * (P2[0] - 2 * P1[0] + P0[0]) + 6 * t * (P3[0] - 2 * P2[0] + P1[0])
  const d2y = 6 * t1 * (P2[1] - 2 * P1[1] + P0[1]) + 6 * t * (P3[1] - 2 * P2[1] + P1[1])

  const cross = d1[0] * d2y - d1[1] * d2x
  const speed = Math.sqrt(d1[0] * d1[0] + d1[1] * d1[1])
  if (speed < 1e-10) return 0

  return Math.abs(cross) / (speed * speed * speed)
}

export function cubicBezierArcLength(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  samples: number = 64,
): number {
  let length = 0
  let prevX = P0[0]
  let prevY = P0[1]

  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const pt = evaluateCubicBezier(P0, P1, P2, P3, t)
    const dx = pt[0] - prevX
    const dy = pt[1] - prevY
    length += Math.sqrt(dx * dx + dy * dy)
    prevX = pt[0]
    prevY = pt[1]
  }

  return length
}

export function cubicToQuadraticApprox(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
): { start: [number, number]; control: [number, number]; end: [number, number] } {
  return {
    start: P0,
    control: [
      (3 * P1[0] - P0[0] + 3 * P2[0] - P3[0]) / 4,
      (3 * P1[1] - P0[1] + 3 * P2[1] - P3[1]) / 4,
    ],
    end: P3,
  }
}

export function splitCubicBezier(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  t: number,
): {
  left: { P0: [number, number]; P1: [number, number]; P2: [number, number]; P3: [number, number] }
  right: { P0: [number, number]; P1: [number, number]; P2: [number, number]; P3: [number, number] }
} {
  const lerp = (a: [number, number], b: [number, number], s: number): [number, number] => [
    a[0] + (b[0] - a[0]) * s,
    a[1] + (b[1] - a[1]) * s,
  ]

  const q0 = lerp(P0, P1, t)
  const q1 = lerp(P1, P2, t)
  const q2 = lerp(P2, P3, t)
  const r0 = lerp(q0, q1, t)
  const r1 = lerp(q1, q2, t)
  const s0 = lerp(r0, r1, t)

  return {
    left: { P0, P1: q0, P2: r0, P3: s0 },
    right: { P0: s0, P1: r1, P2: q2, P3 },
  }
}

export function catmullRomToHandles(
  prev: [number, number] | null,
  current: [number, number],
  next: [number, number] | null,
  tension: number = 0.3,
): { handleIn: [number, number]; handleOut: [number, number] } {
  if (!prev && !next) {
    return { handleIn: [0, 0], handleOut: [0, 0] }
  }

  let tangentX = 0
  let tangentY = 0

  if (prev && next) {
    tangentX = (next[0] - prev[0]) * tension
    tangentY = (next[1] - prev[1]) * tension
  } else if (next) {
    tangentX = (next[0] - current[0]) * tension
    tangentY = (next[1] - current[1]) * tension
  } else if (prev) {
    tangentX = (current[0] - prev[0]) * tension
    tangentY = (current[1] - prev[1]) * tension
  }

  return {
    handleIn: [-tangentX, -tangentY],
    handleOut: [tangentX, tangentY],
  }
}

export function getSplineSegment(
  path: TrackPath,
  segIndex: number,
): {
  P0: [number, number]
  P1: [number, number]
  P2: [number, number]
  P3: [number, number]
  startElev: number
  endElev: number
  startWidth: number
  endWidth: number
} {
  const pts = path.controlPoints
  const count = pts.length
  const cp0 = pts[segIndex]
  const cp1 = pts[(segIndex + 1) % count]

  const P0 = cp0.position
  const P3 = cp1.position

  const h0 = cp0.handleOut ?? [0, 0]
  const h1 = cp1.handleIn ?? [0, 0]

  const P1: [number, number] = [P0[0] + h0[0], P0[1] + h0[1]]
  const P2: [number, number] = [P3[0] + h1[0], P3[1] + h1[1]]

  return {
    P0,
    P1,
    P2,
    P3,
    startElev: cp0.elevation,
    endElev: cp1.elevation,
    startWidth: cp0.widthOverride ?? path.width,
    endWidth: cp1.widthOverride ?? path.width,
  }
}

export function getSplineSegmentCount(path: TrackPath): number {
  const n = path.controlPoints.length
  if (n < 2) return 0
  return path.closed ? n : n - 1
}

export function evaluateSplineAt(
  path: TrackPath,
  segIndex: number,
  t: number,
): { position: [number, number]; tangent: [number, number]; elevation: number; width: number } {
  const seg = getSplineSegment(path, segIndex)
  const position = evaluateCubicBezier(seg.P0, seg.P1, seg.P2, seg.P3, t)
  const tangent = evaluateCubicBezierDerivative(seg.P0, seg.P1, seg.P2, seg.P3, t)
  const elevation = seg.startElev + (seg.endElev - seg.startElev) * t
  const width = seg.startWidth + (seg.endWidth - seg.startWidth) * t

  return { position, tangent, elevation, width }
}

export function perpendicularAtPoint(tangent: [number, number]): {
  leftX: number
  leftY: number
  rightX: number
  rightY: number
} {
  const len = Math.sqrt(tangent[0] * tangent[0] + tangent[1] * tangent[1])
  if (len < 1e-10) return { leftX: 0, leftY: 1, rightX: 0, rightY: -1 }

  const nx = -tangent[1] / len
  const ny = tangent[0] / len

  return { leftX: nx, leftY: ny, rightX: -nx, rightY: -ny }
}
