/**
 * Top-down debug snapshot for track-limit events.
 *
 * Drawn as a 2D HTML canvas (no WebGL, no R3F dependency) so it survives
 * any rendering state and never races with the main scene. Picks the car
 * + a configurable window of nearby centerline points, projects them
 * orthographically (top-down: world XZ → canvas XY), and overlays:
 *
 *   - centerline polyline
 *   - track edges (centerline ± half_width)
 *   - off-track threshold rings (where the off-track logic actually fires)
 *   - the 4 wheel positions (rotated by chassis quaternion)
 *   - a marker for chassis center
 *
 * Auto-downloads the resulting PNG so the user can confirm at a glance
 * whether all four wheels really crossed the white line.
 */

import type { TrackRibbonPoint } from '../types/trackObjects'

export interface TrackLimitSnapshotInput {
  carX: number
  carZ: number
  qx: number
  qy: number
  qz: number
  qw: number
  /** Chassis-local wheel offsets [FL, FR, RL, RR], y unused. */
  wheelOffsetsLocal: ReadonlyArray<readonly [number, number, number]>
  centerline: TrackRibbonPoint[]
  halfWidth: number
  /** Off-track buffer past half_width (the engine's enter threshold). */
  offTrackEnterThreshold: number
  /** Per-wheel lateral distance to centerline, for caption. */
  wheelLateralDistances: [number, number, number, number]
  /** Per-wheel tire half-width [FL, FR, RL, RR]. The engine flags off-track
   *  when `wheel_lateral_distance − tire_half_width > halfWidth + enter`. */
  tireHalfWidths: [number, number, number, number]
  /** Whether off-track is currently flagged. */
  isOffTrack: boolean
}

const CANVAS_PX = 800
const VIEW_RADIUS_M = 20 // ±20m window around the car
const PX_PER_M = CANVAS_PX / (2 * VIEW_RADIUS_M)

function worldToCanvas(
  wx: number,
  wz: number,
  carX: number,
  carZ: number,
): [number, number] {
  // World XZ → canvas pixels. Centered on car, +Z up (north), +X right (east).
  // Canvas Y axis is inverted (down is positive), so flip Z sign.
  const cx = CANVAS_PX / 2 + (wx - carX) * PX_PER_M
  const cy = CANVAS_PX / 2 - (wz - carZ) * PX_PER_M
  return [cx, cy]
}

function rotateLocal(
  local: readonly [number, number, number],
  qx: number,
  qy: number,
  qz: number,
  qw: number,
): [number, number, number] {
  // Standard quaternion-vector rotation: v' = q * v * q^-1
  // Implemented inline to avoid pulling in three.js for a debug-only path.
  const [x, y, z] = local
  const ix = qw * x + qy * z - qz * y
  const iy = qw * y + qz * x - qx * z
  const iz = qw * z + qx * y - qy * x
  const iw = -qx * x - qy * y - qz * z
  const rx = ix * qw + iw * -qx + iy * -qz - iz * -qy
  const ry = iy * qw + iw * -qy + iz * -qx - ix * -qz
  const rz = iz * qw + iw * -qz + ix * -qy - iy * -qx
  return [rx, ry, rz]
}

export function captureTrackLimitSnapshot(input: TrackLimitSnapshotInput): string | null {
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_PX
  canvas.height = CANVAS_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX)

  // Grid (every 5m)
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1
  for (let m = -VIEW_RADIUS_M; m <= VIEW_RADIUS_M; m += 5) {
    const [gx, _gy] = worldToCanvas(input.carX + m, input.carZ, input.carX, input.carZ)
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, CANVAS_PX)
    ctx.stroke()
    const [_gx2, gy2] = worldToCanvas(input.carX, input.carZ + m, input.carX, input.carZ)
    ctx.beginPath()
    ctx.moveTo(0, gy2)
    ctx.lineTo(CANVAS_PX, gy2)
    ctx.stroke()
  }

  // Centerline points within view window
  const visiblePoints = input.centerline.filter(p => {
    const dx = p.x - input.carX
    const dz = p.z - input.carZ
    return Math.abs(dx) < VIEW_RADIUS_M + 5 && Math.abs(dz) < VIEW_RADIUS_M + 5
  })

  // Track edges (drawn as offset polylines). Approximated per-segment using
  // the local tangent for the perpendicular direction.
  const drawEdgeAt = (offsetSign: 1 | -1, distance: number, color: string, lineWidth: number) => {
    if (visiblePoints.length < 2) return
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    let started = false
    for (let i = 0; i < visiblePoints.length; i++) {
      const p = visiblePoints[i]
      // Tangent: forward difference except at last point where use backward
      const next = visiblePoints[Math.min(i + 1, visiblePoints.length - 1)]
      const prev = visiblePoints[Math.max(i - 1, 0)]
      let tx = next.x - prev.x
      let tz = next.z - prev.z
      const tlen = Math.sqrt(tx * tx + tz * tz) || 1
      tx /= tlen
      tz /= tlen
      // Perpendicular (right side): rotate (tx, tz) by -90° → (tz, -tx)
      const px = tz * offsetSign * distance
      const pz = -tx * offsetSign * distance
      const [cx, cy] = worldToCanvas(p.x + px, p.z + pz, input.carX, input.carZ)
      if (!started) {
        ctx.moveTo(cx, cy)
        started = true
      } else {
        ctx.lineTo(cx, cy)
      }
    }
    ctx.stroke()
  }

  // White line at half_width (the visual road edge)
  drawEdgeAt(1, input.halfWidth, '#ffffff', 2)
  drawEdgeAt(-1, input.halfWidth, '#ffffff', 2)

  // Off-track threshold (where the engine actually fires)
  const offTrackDistance = input.halfWidth + input.offTrackEnterThreshold
  drawEdgeAt(1, offTrackDistance, '#ff4444', 1)
  drawEdgeAt(-1, offTrackDistance, '#ff4444', 1)

  // Centerline itself
  if (visiblePoints.length >= 2) {
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    visiblePoints.forEach((p, i) => {
      const [cx, cy] = worldToCanvas(p.x, p.z, input.carX, input.carZ)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Car chassis center
  const [carCx, carCy] = worldToCanvas(input.carX, input.carZ, input.carX, input.carZ)
  ctx.fillStyle = '#00ff88'
  ctx.beginPath()
  ctx.arc(carCx, carCy, 6, 0, Math.PI * 2)
  ctx.fill()

  // 4 wheels (world position = car + R * local_offset)
  // Off-track per wheel: tire inner edge (= center − tire_half_width) past
  // halfWidth + enter_threshold. This is the actual engine rule, so a
  // wheel only colors red when *its tire* has fully crossed the line.
  const wheelLabels = ['FL', 'FR', 'RL', 'RR']
  input.wheelOffsetsLocal.forEach((offset, i) => {
    const [wx, _wy, wz] = rotateLocal(offset, input.qx, input.qy, input.qz, input.qw)
    const wheelWorldX = input.carX + wx
    const wheelWorldZ = input.carZ + wz
    const [cx, cy] = worldToCanvas(wheelWorldX, wheelWorldZ, input.carX, input.carZ)
    const centerDist = input.wheelLateralDistances[i]
    const tireHW = input.tireHalfWidths[i]
    const innerEdgeDist = centerDist - tireHW
    const wheelOffEdge = innerEdgeDist > input.halfWidth + input.offTrackEnterThreshold

    // Draw the tire footprint as a small rectangle aligned with the
    // car's lateral axis so it's visually obvious how wide the tire is
    // relative to the white line.
    const tireRadiusPx = tireHW * PX_PER_M
    ctx.fillStyle = wheelOffEdge ? 'rgba(255, 68, 68, 0.6)' : 'rgba(68, 255, 68, 0.6)'
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(tireRadiusPx, 4), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = wheelOffEdge ? '#ff4444' : '#44ff44'
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px monospace'
    ctx.fillText(
      `${wheelLabels[i]} c=${centerDist.toFixed(2)} edge=${innerEdgeDist.toFixed(2)}m`,
      cx + tireRadiusPx + 4,
      cy - 4,
    )
  })

  // Caption
  ctx.fillStyle = '#ffffff'
  ctx.font = '14px monospace'
  ctx.fillText(
    `track-limit ${input.isOffTrack ? 'TRIGGERED' : 'cleared'}  car=(${input.carX.toFixed(1)}, ${input.carZ.toFixed(1)})  half_width=${input.halfWidth}m  enter_thresh=${input.offTrackEnterThreshold}m`,
    10,
    20,
  )
  ctx.fillStyle = '#888'
  ctx.font = '11px monospace'
  ctx.fillText(
    'white = road edge   red = off-track trigger ring (half_width + enter_thresh)',
    10,
    38,
  )
  ctx.fillText(
    'wheel disc = tire footprint   center dot = wheel center   red disc = tire inner edge past trigger',
    10,
    54,
  )

  // Return as data URL so the caller can stash it (HUD thumbnail list,
  // store, etc.) without forcing a file download that would steal focus
  // and cost the user lap time.
  return canvas.toDataURL('image/png')
}
