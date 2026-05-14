import type { PlacedObject } from '@/types/trackObjects'
import { isCurveMode } from '@/types/trackObjects'
import type { MinimapTransforms } from '../helpers'

export function drawRoads(
  ctx: CanvasRenderingContext2D,
  roads: PlacedObject[],
  t: MinimapTransforms,
) {
  const { toScreenX, toScreenZ, rotX, rotZ } = t

  for (const road of roads) {
    ctx.beginPath()

    const maxElev = Math.max(road.startElevation ?? 0, road.endElevation ?? 0)
    if (maxElev > 0) {
      const intensity = Math.min(1, maxElev / 20)
      const r = Math.round(100 + 155 * (1 - intensity))
      const g = Math.round(100 + 155 * (1 - intensity))
      const b = Math.round(170 + 85 * intensity)
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
    } else {
      ctx.strokeStyle = road.flowDirection ? '#22c55e' : '#aaaaaa'
    }

    ctx.lineWidth = 2.5

    if (road.type === 'track_ribbon' && road.ribbonPoints && road.ribbonPoints.length > 1) {
      const pts = road.ribbonPoints
      const first = pts[0]
      const sx0 = toScreenX(first.x)
      const sz0 = toScreenZ(first.z)
      ctx.moveTo(rotX(sx0, sz0), rotZ(sx0, sz0))
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i]
        const sx = toScreenX(p.x)
        const sz = toScreenZ(p.z)
        ctx.lineTo(rotX(sx, sz), rotZ(sx, sz))
      }
      if (road.ribbonClosed) {
        ctx.lineTo(rotX(sx0, sz0), rotZ(sx0, sz0))
      }
      ctx.stroke()
      if (road.flowDirection) drawRibbonFlowArrow(ctx, road, t)
      continue
    }

    if (isCurveMode(road.trackMode) && road.controlPoint) {
      const sx = toScreenX(road.startPoint![0])
      const sz = toScreenZ(road.startPoint![2])
      const cpx = toScreenX(road.controlPoint[0])
      const cpz = toScreenZ(road.controlPoint[2])
      const ex = toScreenX(road.endPoint![0])
      const ez = toScreenZ(road.endPoint![2])

      ctx.moveTo(rotX(sx, sz), rotZ(sx, sz))
      ctx.quadraticCurveTo(rotX(cpx, cpz), rotZ(cpx, cpz), rotX(ex, ez), rotZ(ex, ez))
    } else {
      const sx = toScreenX(road.startPoint![0])
      const sz = toScreenZ(road.startPoint![2])
      const ex = toScreenX(road.endPoint![0])
      const ez = toScreenZ(road.endPoint![2])

      ctx.moveTo(rotX(sx, sz), rotZ(sx, sz))
      ctx.lineTo(rotX(ex, ez), rotZ(ex, ez))
    }

    ctx.stroke()

    if (road.flowDirection) drawFlowArrow(ctx, road, t)
  }
}

function drawFlowArrow(
  ctx: CanvasRenderingContext2D,
  road: PlacedObject,
  t: MinimapTransforms,
) {
  const { toScreenX, toScreenZ, rotX, rotZ, scale, angle } = t
  const isForward = road.flowDirection === 'forward'
  let mx: number, mz: number, dx: number, dz: number

  if (isCurveMode(road.trackMode) && road.controlPoint) {
    const tt = 0.5
    const s0x = road.startPoint![0]
    const s0z = road.startPoint![2]
    const cpx = road.controlPoint[0]
    const cpz = road.controlPoint[2]
    const e0x = road.endPoint![0]
    const e0z = road.endPoint![2]

    mx = toScreenX((1 - tt) * (1 - tt) * s0x + 2 * (1 - tt) * tt * cpx + tt * tt * e0x)
    mz = toScreenZ((1 - tt) * (1 - tt) * s0z + 2 * (1 - tt) * tt * cpz + tt * tt * e0z)

    const tangentX = 2 * (1 - tt) * (cpx - s0x) + 2 * tt * (e0x - cpx)
    const tangentZ = 2 * (1 - tt) * (cpz - s0z) + 2 * tt * (e0z - cpz)
    const len = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ) || 1
    dx = (tangentX / len) * scale
    dz = (tangentZ / len) * scale
  } else {
    const sx = road.startPoint![0]
    const sz = road.startPoint![2]
    const ex = road.endPoint![0]
    const ez = road.endPoint![2]

    mx = toScreenX((sx + ex) / 2)
    mz = toScreenZ((sz + ez) / 2)

    const rawDx = ex - sx
    const rawDz = ez - sz
    const len = Math.sqrt(rawDx * rawDx + rawDz * rawDz) || 1
    dx = (rawDx / len) * scale
    dz = (rawDz / len) * scale
  }

  if (!isForward) {
    dx = -dx
    dz = -dz
  }

  const normLen = Math.sqrt(dx * dx + dz * dz) || 1
  const ndx = dx / normLen
  const ndz = dz / normLen

  const rndx = ndx * Math.cos(angle) - ndz * Math.sin(angle)
  const rndz = ndx * Math.sin(angle) + ndz * Math.cos(angle)

  const rmx = rotX(mx, mz)
  const rmz = rotZ(mx, mz)

  const arrowSize = 5

  ctx.beginPath()
  ctx.fillStyle = '#22c55e'
  ctx.moveTo(rmx + rndx * arrowSize, rmz + rndz * arrowSize)
  ctx.lineTo(
    rmx - rndx * arrowSize * 0.5 + rndz * arrowSize * 0.5,
    rmz - rndz * arrowSize * 0.5 - rndx * arrowSize * 0.5,
  )
  ctx.lineTo(
    rmx - rndx * arrowSize * 0.5 - rndz * arrowSize * 0.5,
    rmz - rndz * arrowSize * 0.5 + rndx * arrowSize * 0.5,
  )
  ctx.closePath()
  ctx.fill()
}

function drawRibbonFlowArrow(
  ctx: CanvasRenderingContext2D,
  road: PlacedObject,
  t: MinimapTransforms,
) {
  const pts = road.ribbonPoints
  if (!pts || pts.length < 2) return

  const { toScreenX, toScreenZ, rotX, rotZ, scale, angle } = t
  const isForward = road.flowDirection === 'forward'

  const midIndex = Math.floor(pts.length / 2)
  const a = pts[Math.max(0, midIndex - 1)]
  const b = pts[Math.min(pts.length - 1, midIndex)]

  const mx = toScreenX((a.x + b.x) / 2)
  const mz = toScreenZ((a.z + b.z) / 2)

  let rawDx = b.x - a.x
  let rawDz = b.z - a.z
  if (!isForward) {
    rawDx = -rawDx
    rawDz = -rawDz
  }
  const len = Math.sqrt(rawDx * rawDx + rawDz * rawDz) || 1
  const ndx = (rawDx / len) * scale
  const ndz = (rawDz / len) * scale

  const arrowLen = Math.sqrt(ndx * ndx + ndz * ndz) || 1
  const ux = ndx / arrowLen
  const uz = ndz / arrowLen

  const rndx = ux * Math.cos(angle) - uz * Math.sin(angle)
  const rndz = ux * Math.sin(angle) + uz * Math.cos(angle)

  const rmx = rotX(mx, mz)
  const rmz = rotZ(mx, mz)
  const arrowSize = 5

  ctx.beginPath()
  ctx.fillStyle = '#22c55e'
  ctx.moveTo(rmx + rndx * arrowSize, rmz + rndz * arrowSize)
  ctx.lineTo(
    rmx - rndx * arrowSize * 0.5 + rndz * arrowSize * 0.5,
    rmz - rndz * arrowSize * 0.5 - rndx * arrowSize * 0.5,
  )
  ctx.lineTo(
    rmx - rndx * arrowSize * 0.5 - rndz * arrowSize * 0.5,
    rmz - rndz * arrowSize * 0.5 + rndx * arrowSize * 0.5,
  )
  ctx.closePath()
  ctx.fill()
}
