#!/usr/bin/env bun

interface Point2D {
  x: number
  z: number
}

interface JunctionEdge {
  left: [number, number, number]
  right: [number, number, number]
  heading: number
}

interface PlacedObject {
  id: string
  type: 'road' | 'curb' | 'barrier' | 'checkpoint' | 'cone'
  position: [number, number, number]
  rotation: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  controlPoint?: [number, number, number]
  trackMode?: 'straight' | 'curve'
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
  checkpointType?: 'start-finish' | 'sector'
  checkpointOrder?: number
  width?: number
  startElevation?: number
  endElevation?: number
}

interface CsvCircuitConfig {
  csvPath: string
  name: string
  displayName: string
  sectorSplits: [number, number]
  startFinishFraction: number
  elevationZones?: { startFraction: number; endFraction: number; elevation: number }[]
}

const TRACK_WIDTH = 12
const HALF_WIDTH = TRACK_WIDTH / 2
const SIMPLIFY_TOLERANCE = 1.0
const MAX_SEGMENT_LENGTH = 40
const CURVATURE_THRESHOLD = 0.005
const HEADING_CURVE_THRESHOLD = 0.01
const BARRIER_OFFSET = HALF_WIDTH + 2.0
const BARRIER_CURVATURE_THRESHOLD = 0.006
const BARRIER_SPACING_CORNER = 15
const BARRIER_SPACING_STRAIGHT = 40

const CSV_CIRCUITS: Record<string, CsvCircuitConfig> = {
  silverstone: {
    csvPath: '/tmp/silverstone_raw.csv',
    name: 'silverstone',
    displayName: 'Silverstone Circuit',
    sectorSplits: [0.33, 0.66],
    startFinishFraction: 0.0,
  },
  suzuka: {
    csvPath: '/tmp/suzuka_raw.csv',
    name: 'suzuka',
    displayName: 'Suzuka International Racing Course',
    sectorSplits: [0.33, 0.66],
    startFinishFraction: 0.0,
    elevationZones: [
      { startFraction: 0.55, endFraction: 0.62, elevation: 6.0 },
    ],
  },
}

function parseCsv(content: string): { points: Point2D[]; widths: { right: number; left: number }[] } {
  const lines = content.trim().split('\n')
  const points: Point2D[] = []
  const widths: { right: number; left: number }[] = []

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue
    const parts = line.split(',')
    if (parts.length < 4) continue
    const xm = parseFloat(parts[0])
    const ym = parseFloat(parts[1])
    const wr = parseFloat(parts[2])
    const wl = parseFloat(parts[3])
    if (isNaN(xm) || isNaN(ym)) continue
    points.push({ x: xm, z: ym })
    widths.push({ right: wr, left: wl })
  }

  return { points, widths }
}

function centerPoints(points: Point2D[]): Point2D[] {
  let cx = 0, cz = 0
  for (const p of points) { cx += p.x; cz += p.z }
  cx /= points.length
  cz /= points.length
  return points.map(p => ({ x: p.x - cx, z: p.z - cz }))
}

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x
  const dz = lineEnd.z - lineStart.z
  const lineLenSq = dx * dx + dz * dz
  if (lineLenSq === 0) {
    const ddx = point.x - lineStart.x
    const ddz = point.z - lineStart.z
    return Math.sqrt(ddx * ddx + ddz * ddz)
  }
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / lineLenSq))
  const projX = lineStart.x + t * dx
  const projZ = lineStart.z + t * dz
  const ddx = point.x - projX
  const ddz = point.z - projZ
  return Math.sqrt(ddx * ddx + ddz * ddz)
}

function douglasPeucker(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points
  let maxDist = 0
  let maxIdx = 0
  const end = points.length - 1
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[end]]
}

function subdivideIfNeeded(points: Point2D[], maxLen: number = 40): Point2D[] {
  const result: Point2D[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const dx = curr.x - prev.x
    const dz = curr.z - prev.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > maxLen) {
      const n = Math.ceil(dist / maxLen)
      for (let j = 1; j < n; j++) {
        const t = j / n
        result.push({ x: prev.x + dx * t, z: prev.z + dz * t })
      }
    }
    result.push(curr)
  }
  return result
}

function computeCurvature(p0: Point2D, p1: Point2D, p2: Point2D): number {
  const area = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z)) / 2
  const d01 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2)
  const d12 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2)
  const d02 = Math.sqrt((p2.x - p0.x) ** 2 + (p2.z - p0.z) ** 2)
  const denom = d01 * d12 * d02
  if (denom < 0.001) return 0
  return (4 * area) / denom
}

function fitQuadraticBezier(points: Point2D[]): { control: Point2D; error: number } {
  const start = points[0]
  const end = points[points.length - 1]
  const t0x = points[1].x - points[0].x
  const t0z = points[1].z - points[0].z
  const t1x = points[points.length - 1].x - points[points.length - 2].x
  const t1z = points[points.length - 1].z - points[points.length - 2].z
  const det = t0x * t1z - t0z * t1x
  if (Math.abs(det) < 0.001) {
    const mid = points[Math.floor(points.length / 2)]
    return { control: { x: mid.x, z: mid.z }, error: 0 }
  }
  const dx = end.x - start.x
  const dz = end.z - start.z
  const t = (dx * t1z - dz * t1x) / det
  const control: Point2D = { x: start.x + t * t0x, z: start.z + t * t0z }
  let maxError = 0
  for (let i = 1; i < points.length - 1; i++) {
    const u = i / (points.length - 1)
    const u1 = 1 - u
    const bx = u1 * u1 * start.x + 2 * u1 * u * control.x + u * u * end.x
    const bz = u1 * u1 * start.z + 2 * u1 * u * control.z + u * u * end.z
    const err = Math.sqrt((points[i].x - bx) ** 2 + (points[i].z - bz) ** 2)
    maxError = Math.max(maxError, err)
  }
  return { control, error: maxError }
}

function dist2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dz * dz)
}

function computeJunctionEdges(
  points: Point2D[],
  halfWidth: number,
  getElevation: (fraction: number) => number,
  isClosed: boolean,
): JunctionEdge[] {
  const n = points.length
  const edges: JunctionEdge[] = []

  for (let i = 0; i < n; i++) {
    const fraction = i / (n - 1)
    const elev = getElevation(fraction)

    let inX: number, inZ: number, outX: number, outZ: number

    if (i === 0) {
      if (isClosed) {
        inX = points[0].x - points[n - 2].x
        inZ = points[0].z - points[n - 2].z
      } else {
        inX = points[1].x - points[0].x
        inZ = points[1].z - points[0].z
      }
      outX = points[1].x - points[0].x
      outZ = points[1].z - points[0].z
    } else if (i === n - 1) {
      inX = points[n - 1].x - points[n - 2].x
      inZ = points[n - 1].z - points[n - 2].z
      if (isClosed) {
        outX = points[1].x - points[0].x
        outZ = points[1].z - points[0].z
      } else {
        outX = inX
        outZ = inZ
      }
    } else {
      inX = points[i].x - points[i - 1].x
      inZ = points[i].z - points[i - 1].z
      outX = points[i + 1].x - points[i].x
      outZ = points[i + 1].z - points[i].z
    }

    const inLen = Math.sqrt(inX * inX + inZ * inZ) || 1
    const outLen = Math.sqrt(outX * outX + outZ * outZ) || 1
    const nInX = inX / inLen
    const nInZ = inZ / inLen
    const nOutX = outX / outLen
    const nOutZ = outZ / outLen

    let tx = nInX + nOutX
    let tz = nInZ + nOutZ
    const tLen = Math.sqrt(tx * tx + tz * tz)
    if (tLen < 0.001) {
      tx = nOutX
      tz = nOutZ
    } else {
      tx /= tLen
      tz /= tLen
    }

    const perpX = -tz
    const perpZ = tx
    const heading = Math.atan2(tx, tz)

    const p = points[i]
    edges.push({
      left: [p.x + perpX * halfWidth, elev, p.z + perpZ * halfWidth],
      right: [p.x - perpX * halfWidth, elev, p.z - perpZ * halfWidth],
      heading,
    })
  }

  return edges
}

function computeControlPointFromHeadings(
  start: Point2D,
  end: Point2D,
  startHeading: number,
  endHeading: number,
): Point2D {
  const t0x = Math.sin(startHeading)
  const t0z = Math.cos(startHeading)
  const t1x = Math.sin(endHeading)
  const t1z = Math.cos(endHeading)

  const det = t0x * t1z - t0z * t1x
  if (Math.abs(det) < 0.001) {
    return { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }
  }

  const dx = end.x - start.x
  const dz = end.z - start.z
  const t = (dx * t1z - dz * t1x) / det

  const tClamped = Math.max(-2, Math.min(2, t / dist2D(start, end))) * dist2D(start, end)

  return { x: start.x + tClamped * t0x, z: start.z + tClamped * t0z }
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

function generateRoadSegments(points: Point2D[], config: CsvCircuitConfig): PlacedObject[] {
  const objects: PlacedObject[] = []
  let segId = 0
  const segments: { startIdx: number; endIdx: number; subPoints: Point2D[] }[] = []
  let currentStart = 0
  let currentSubPoints: Point2D[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const candidateLen = dist2D(currentSubPoints[currentSubPoints.length - 1], points[i])
    let currentLen = 0
    for (let j = 1; j < currentSubPoints.length; j++) {
      currentLen += dist2D(currentSubPoints[j - 1], currentSubPoints[j])
    }
    const wouldBeLen = currentLen + candidateLen
    const wouldBeChord = dist2D(currentSubPoints[0], points[i])

    if (currentSubPoints.length > 1 && (wouldBeLen >= MAX_SEGMENT_LENGTH || wouldBeChord >= MAX_SEGMENT_LENGTH)) {
      segments.push({ startIdx: currentStart, endIdx: i - 1, subPoints: [...currentSubPoints] })
      currentStart = i - 1
      currentSubPoints = [points[i - 1], points[i]]
    } else {
      currentSubPoints.push(points[i])
    }

    if (i === points.length - 1 && currentSubPoints.length > 1) {
      segments.push({ startIdx: currentStart, endIdx: i, subPoints: currentSubPoints })
    }
  }

  function getElevation(fraction: number): number {
    if (!config.elevationZones) return 0
    for (const zone of config.elevationZones) {
      if (fraction >= zone.startFraction && fraction <= zone.endFraction) {
        const zoneMid = (zone.startFraction + zone.endFraction) / 2
        const zoneHalf = (zone.endFraction - zone.startFraction) / 2
        const t = (fraction - zoneMid) / zoneHalf
        const smooth = Math.cos(t * Math.PI) * 0.5 + 0.5
        return zone.elevation * smooth
      }
    }
    return 0
  }

  const first = points[0]
  const last = points[points.length - 1]
  const closureGap = dist2D(first, last)
  const isClosed = closureGap < 5.0

  const junctions = computeJunctionEdges(points, HALF_WIDTH, (fraction) => {
    return getElevation(fraction)
  }, isClosed)

  const totalPoints = points.length

  for (const seg of segments) {
    const startFraction = seg.startIdx / (totalPoints - 1)
    const endFraction = seg.endIdx / (totalPoints - 1)
    const startElev = getElevation(startFraction)
    const endElev = getElevation(endFraction)

    const start = points[seg.startIdx]
    const end = points[seg.endIdx]
    const startPt: [number, number, number] = [start.x, startElev, start.z]
    const endPt: [number, number, number] = [end.x, endElev, end.z]

    const startEdge = junctions[seg.startIdx]
    const endEdge = junctions[seg.endIdx]

    let isCurve = false
    let controlPt: [number, number, number] | undefined

    if (seg.subPoints.length >= 3) {
      const midIdx = Math.floor(seg.subPoints.length / 2)
      const curvature = computeCurvature(seg.subPoints[0], seg.subPoints[midIdx], seg.subPoints[seg.subPoints.length - 1])
      if (curvature > CURVATURE_THRESHOLD) {
        isCurve = true
        const fit = fitQuadraticBezier(seg.subPoints)
        const ctrlElev = (startElev + endElev) / 2
        controlPt = [fit.control.x, ctrlElev, fit.control.z]
      }
    }

    if (!isCurve) {
      const headingDiff = Math.abs(normalizeAngle(endEdge.heading - startEdge.heading))
      if (headingDiff > HEADING_CURVE_THRESHOLD) {
        isCurve = true
        const cp = computeControlPointFromHeadings(start, end, startEdge.heading, endEdge.heading)
        const ctrlElev = (startElev + endElev) / 2
        controlPt = [cp.x, ctrlElev, cp.z]
      }
    }

    const trackMode = isCurve ? 'curve' : 'straight'
    const midX = (start.x + end.x) / 2
    const midZ = (start.z + end.z) / 2
    const midElev = (startElev + endElev) / 2

    const roadObj: PlacedObject = {
      id: `road_${segId++}`,
      type: 'road',
      position: [midX, midElev, midZ],
      rotation: 0,
      startPoint: startPt,
      endPoint: endPt,
      trackMode,
      startLeftEdge: startEdge.left,
      startRightEdge: startEdge.right,
      endLeftEdge: endEdge.left,
      endRightEdge: endEdge.right,
    }

    if (isCurve && controlPt) {
      roadObj.controlPoint = controlPt
    }
    if (startElev !== 0 || endElev !== 0) {
      roadObj.startElevation = startElev
      roadObj.endElevation = endElev
    }

    objects.push(roadObj)
  }

  return objects
}

function generateCurbs(roads: PlacedObject[]): PlacedObject[] {
  const curbs: PlacedObject[] = []
  let curbId = 0
  for (const road of roads) {
    if (!road.startPoint || !road.endPoint) continue
    if (road.trackMode !== 'curve' || !road.controlPoint) continue
    for (const side of ['left', 'right'] as const) {
      curbs.push({
        id: `curb_${curbId++}`,
        type: 'curb',
        position: [0, 0, 0],
        rotation: 0,
        parentRoadId: road.id,
        edgeSide: side,
        startT: 0.05,
        endT: 0.95,
      } as any)
    }
  }
  return curbs
}

function generateCheckpoints(roads: PlacedObject[], config: CsvCircuitConfig): PlacedObject[] {
  const checkpoints: PlacedObject[] = []
  const totalRoads = roads.length

  function makeCheckpoint(
    id: string,
    road: PlacedObject,
    type: 'start-finish' | 'sector',
    order: number,
  ): PlacedObject {
    const sp = road.startPoint!
    const ep = road.endPoint!
    const rotation = Math.atan2(ep[0] - sp[0], ep[2] - sp[2])
    const perpAngle = rotation + Math.PI / 2
    const hw = TRACK_WIDTH / 2
    const cpStartPoint: [number, number, number] = [
      sp[0] + Math.sin(perpAngle) * hw,
      sp[1],
      sp[2] + Math.cos(perpAngle) * hw,
    ]
    const cpEndPoint: [number, number, number] = [
      sp[0] - Math.sin(perpAngle) * hw,
      sp[1],
      sp[2] - Math.cos(perpAngle) * hw,
    ]
    return {
      id,
      type: 'checkpoint',
      position: [...sp] as [number, number, number],
      rotation,
      startPoint: cpStartPoint,
      endPoint: cpEndPoint,
      checkpointType: type,
      checkpointOrder: order,
      width: TRACK_WIDTH,
    }
  }

  const sfIdx = Math.floor(config.startFinishFraction * totalRoads)
  const sfRoad = roads[sfIdx]
  if (sfRoad?.startPoint && sfRoad?.endPoint) {
    checkpoints.push(makeCheckpoint('checkpoint_sf', sfRoad, 'start-finish', 0))
  }

  for (let i = 0; i < config.sectorSplits.length; i++) {
    const fraction = config.sectorSplits[i]
    const idx = Math.floor(fraction * totalRoads)
    const road = roads[idx]
    if (road?.startPoint && road?.endPoint) {
      checkpoints.push(makeCheckpoint(`checkpoint_s${i + 1}`, road, 'sector', i + 1))
    }
  }

  return checkpoints
}

function resamplePolyline(points: { x: number; z: number }[], spacing: number): { x: number; z: number }[] {
  if (points.length < 2) return [...points]

  let totalLen = 0
  const segLens: number[] = []
  for (let i = 1; i < points.length; i++) {
    const d = dist2D(points[i - 1], points[i])
    segLens.push(d)
    totalLen += d
  }

  const count = Math.max(2, Math.floor(totalLen / spacing))
  const step = totalLen / count
  const result: { x: number; z: number }[] = [points[0]]

  let segIdx = 0
  let segProgress = 0

  for (let i = 1; i < count; i++) {
    let remaining = step
    while (remaining > 0 && segIdx < segLens.length) {
      const available = segLens[segIdx] - segProgress
      if (remaining <= available) {
        segProgress += remaining
        remaining = 0
      } else {
        remaining -= available
        segIdx++
        segProgress = 0
      }
    }
    if (segIdx >= segLens.length) segIdx = segLens.length - 1

    const t = segLens[segIdx] > 0 ? segProgress / segLens[segIdx] : 0
    const a = points[segIdx]
    const b = points[Math.min(segIdx + 1, points.length - 1)]
    result.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
    })
  }

  result.push(points[points.length - 1])
  return result
}

function computeLocalCurvatures(roads: PlacedObject[]): number[] {
  const curvatures: number[] = []
  for (let i = 0; i < roads.length; i++) {
    const prev = roads[Math.max(0, i - 1)]
    const curr = roads[i]
    const next = roads[Math.min(roads.length - 1, i + 1)]
    if (!prev.startPoint || !curr.startPoint || !curr.endPoint || !next.endPoint) {
      curvatures.push(0)
      continue
    }
    const p0: Point2D = { x: prev.startPoint[0], z: prev.startPoint[2] }
    const p1: Point2D = { x: curr.startPoint[0], z: curr.startPoint[2] }
    const p2: Point2D = { x: next.endPoint[0], z: next.endPoint[2] }
    curvatures.push(computeCurvature(p0, p1, p2))
  }
  return curvatures
}

function generateBarriers(roads: PlacedObject[]): PlacedObject[] {
  const curvatures = computeLocalCurvatures(roads)

  const barrierZones: { startIdx: number; endIdx: number }[] = []
  let zoneStart = -1
  const MARGIN = 2

  for (let i = 0; i < roads.length; i++) {
    if (curvatures[i] > BARRIER_CURVATURE_THRESHOLD) {
      if (zoneStart === -1) zoneStart = Math.max(0, i - MARGIN)
    } else {
      if (zoneStart !== -1) {
        barrierZones.push({ startIdx: zoneStart, endIdx: Math.min(roads.length - 1, i + MARGIN) })
        zoneStart = -1
      }
    }
  }
  if (zoneStart !== -1) {
    barrierZones.push({ startIdx: zoneStart, endIdx: roads.length - 1 })
  }

  const merged: { startIdx: number; endIdx: number }[] = []
  for (const zone of barrierZones) {
    if (merged.length > 0 && zone.startIdx <= merged[merged.length - 1].endIdx + 1) {
      merged[merged.length - 1].endIdx = Math.max(merged[merged.length - 1].endIdx, zone.endIdx)
    } else {
      merged.push({ ...zone })
    }
  }

  const barriers: PlacedObject[] = []
  let barrierId = 0

  for (const zone of merged) {
    for (let i = zone.startIdx; i <= zone.endIdx; i++) {
      const road = roads[i]
      if (!road.startPoint || !road.endPoint) continue

      const isCurve = road.trackMode === 'curve' && road.controlPoint

      if (isCurve) {
        const sp = road.startPoint
        const ep = road.endPoint
        const cp = road.controlPoint!

        const offsetBarrier = (sign: number, side: string) => {
          const sampleCount = 5
          const offsetPts: [number, number, number][] = []
          for (let s = 0; s <= sampleCount; s++) {
            const t = s / sampleCount
            const u = 1 - t
            const px = u * u * sp[0] + 2 * u * t * cp[0] + t * t * ep[0]
            const pz = u * u * sp[2] + 2 * u * t * cp[2] + t * t * ep[2]
            const dtx = 2 * (u * (cp[0] - sp[0]) + t * (ep[0] - cp[0]))
            const dtz = 2 * (u * (cp[2] - sp[2]) + t * (ep[2] - cp[2]))
            const tLen = Math.sqrt(dtx * dtx + dtz * dtz) || 1
            const perpX = -dtz / tLen
            const perpZ = dtx / tLen
            offsetPts.push([px + sign * perpX * BARRIER_OFFSET, 0, pz + sign * perpZ * BARRIER_OFFSET])
          }

          const bStart = offsetPts[0]
          const bEnd = offsetPts[offsetPts.length - 1]
          const bMid = offsetPts[Math.floor(offsetPts.length / 2)]

          const bsp: [number, number, number] = bStart
          const bep: [number, number, number] = bEnd
          const bcp: [number, number, number] = [
            bMid[0] * 2 - (bStart[0] + bEnd[0]) / 2,
            0,
            bMid[2] * 2 - (bStart[2] + bEnd[2]) / 2,
          ]

          const bmx = (bsp[0] + bep[0]) / 2
          const bmz = (bsp[2] + bep[2]) / 2

          barriers.push({
            id: `barrier_${side}_${barrierId}`,
            type: 'barrier',
            position: [bmx, 0, bmz],
            rotation: 0,
            startPoint: bsp,
            endPoint: bep,
            controlPoint: bcp,
            trackMode: 'curve',
          })
        }

        offsetBarrier(1, 'l')
        offsetBarrier(-1, 'r')
        barrierId++
      } else {
        const dx = road.endPoint[0] - road.startPoint[0]
        const dz = road.endPoint[2] - road.startPoint[2]
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len < 0.01) continue
        const tx = dx / len
        const tz = dz / len
        const perpX = -tz
        const perpZ = tx

        const midX = (road.startPoint[0] + road.endPoint[0]) / 2
        const midZ = (road.startPoint[2] + road.endPoint[2]) / 2

        for (const { sign, side } of [{ sign: 1, side: 'l' }, { sign: -1, side: 'r' }]) {
          barriers.push({
            id: `barrier_${side}_${barrierId}`,
            type: 'barrier',
            position: [midX + sign * perpX * BARRIER_OFFSET, 0, midZ + sign * perpZ * BARRIER_OFFSET],
            rotation: 0,
            startPoint: [
              road.startPoint[0] + sign * perpX * BARRIER_OFFSET, 0,
              road.startPoint[2] + sign * perpZ * BARRIER_OFFSET,
            ],
            endPoint: [
              road.endPoint[0] + sign * perpX * BARRIER_OFFSET, 0,
              road.endPoint[2] + sign * perpZ * BARRIER_OFFSET,
            ],
            trackMode: 'straight',
          })
        }
        barrierId++
      }
    }
  }

  return barriers
}

function ensureCircuitClosure(points: Point2D[], threshold: number = 5.0): Point2D[] {
  const first = points[0]
  const last = points[points.length - 1]
  const dx = last.x - first.x
  const dz = last.z - first.z
  const gap = Math.sqrt(dx * dx + dz * dz)
  if (gap > threshold) {
    return [...points, { ...first }]
  }
  return points
}

function verifyEdgeGaps(roads: PlacedObject[]): { maxEdgeGap: number; gapCount: number } {
  let maxEdgeGap = 0
  let gapCount = 0
  for (let i = 1; i < roads.length; i++) {
    const prev = roads[i - 1]
    const curr = roads[i]
    if (prev.endLeftEdge && curr.startLeftEdge) {
      const dx = curr.startLeftEdge[0] - prev.endLeftEdge[0]
      const dz = curr.startLeftEdge[2] - prev.endLeftEdge[2]
      const gap = Math.sqrt(dx * dx + dz * dz)
      if (gap > 0.1) gapCount++
      maxEdgeGap = Math.max(maxEdgeGap, gap)
    }
    if (prev.endRightEdge && curr.startRightEdge) {
      const dx = curr.startRightEdge[0] - prev.endRightEdge[0]
      const dz = curr.startRightEdge[2] - prev.endRightEdge[2]
      const gap = Math.sqrt(dx * dx + dz * dz)
      if (gap > 0.1) gapCount++
      maxEdgeGap = Math.max(maxEdgeGap, gap)
    }
  }
  return { maxEdgeGap, gapCount }
}

function pointToSegmentDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax
  const dz = bz - az
  const lenSq = dx * dx + dz * dz
  if (lenSq < 0.001) return Math.sqrt((px - ax) ** 2 + (pz - az) ** 2)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq))
  const projX = ax + t * dx
  const projZ = az + t * dz
  return Math.sqrt((px - projX) ** 2 + (pz - projZ) ** 2)
}

function verifyBarrierPositions(barriers: PlacedObject[], roads: PlacedObject[]): { allOutside: boolean; badCount: number } {
  const segments: { ax: number; az: number; bx: number; bz: number }[] = []
  for (const road of roads) {
    if (road.startPoint && road.endPoint) {
      segments.push({
        ax: road.startPoint[0], az: road.startPoint[2],
        bx: road.endPoint[0], bz: road.endPoint[2],
      })
    }
  }

  let badCount = 0
  let minBarrierDist = Infinity
  for (const barrier of barriers) {
    if (!barrier.startPoint) continue
    const bx = barrier.startPoint[0]
    const bz = barrier.startPoint[2]

    let minDist = Infinity
    for (const seg of segments) {
      const d = pointToSegmentDist(bx, bz, seg.ax, seg.az, seg.bx, seg.bz)
      minDist = Math.min(minDist, d)
    }
    minBarrierDist = Math.min(minBarrierDist, minDist)
    if (minDist < HALF_WIDTH * 0.5) badCount++
  }

  return { allOutside: badCount === 0, badCount }
}

async function convertCsvCircuit(circuitName: string): Promise<void> {
  const config = CSV_CIRCUITS[circuitName]
  if (!config) {
    console.error(`Unknown circuit: ${circuitName}`)
    console.log(`Available circuits: ${Object.keys(CSV_CIRCUITS).join(', ')}`)
    process.exit(1)
  }

  console.log(`\nConverting ${config.displayName}...`)

  const csvContent = await Bun.file(config.csvPath).text()
  const { points: rawPoints } = parseCsv(csvContent)
  console.log(`  Parsed ${rawPoints.length} CSV points`)

  const centered = centerPoints(rawPoints)
  const closed = ensureCircuitClosure(centered)
  console.log(`  Centered + closed: ${closed.length} points`)

  const simplified = douglasPeucker(closed, SIMPLIFY_TOLERANCE)
  console.log(`  Simplified: ${closed.length} -> ${simplified.length} points`)

  const subdivided = subdivideIfNeeded(simplified, MAX_SEGMENT_LENGTH)
  console.log(`  Subdivided: ${simplified.length} -> ${subdivided.length} points`)

  const roads = generateRoadSegments(subdivided, config)
  console.log(`  Generated ${roads.length} road segments`)

  const curveCount = roads.filter(r => r.trackMode === 'curve').length
  const straightCount = roads.filter(r => r.trackMode === 'straight').length
  console.log(`    Curves: ${curveCount}, Straights: ${straightCount}`)

  const curbs = generateCurbs(roads)
  console.log(`  Generated ${curbs.length} curbs`)

  const checkpoints = generateCheckpoints(roads, config)
  console.log(`  Generated ${checkpoints.length} checkpoints`)

  const barriers = generateBarriers(roads)
  const curvedBarriers = barriers.filter(b => b.trackMode === 'curve').length
  const straightBarriers = barriers.filter(b => b.trackMode === 'straight').length
  console.log(`  Generated ${barriers.length} barriers (${curvedBarriers} curved, ${straightBarriers} straight)`)

  const allObjects: PlacedObject[] = [...roads, ...curbs, ...checkpoints, ...barriers]
  console.log(`  Total objects: ${allObjects.length}`)

  let totalLength = 0
  let maxSegLen = 0
  for (const road of roads) {
    if (road.startPoint && road.endPoint) {
      const dx = road.endPoint[0] - road.startPoint[0]
      const dz = road.endPoint[2] - road.startPoint[2]
      const len = Math.sqrt(dx * dx + dz * dz)
      totalLength += len
      maxSegLen = Math.max(maxSegLen, len)
    }
  }

  const output = {
    name: config.displayName,
    id: `f1_${config.name}`,
    trackLength: Math.round(totalLength),
    turns: config.sectorSplits.length + 1,
    objects: allObjects,
  }

  const outPath = `src/constants/tracks/${config.name}.json`
  await Bun.write(outPath, JSON.stringify(output, null, 2))
  console.log(`\n  Written to ${outPath}`)
  console.log(`  Track length: ~${Math.round(totalLength)}m`)
  console.log(`  Max segment length: ${maxSegLen.toFixed(1)}m`)

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of centered) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
  }
  console.log(`  Bounding box: ${Math.round(maxX - minX)}m x ${Math.round(maxZ - minZ)}m`)

  for (const cp of checkpoints) {
    if (!cp.startPoint || !cp.endPoint) {
      console.error(`  ERROR: Checkpoint ${cp.id} missing startPoint/endPoint!`)
    } else {
      console.log(`  Checkpoint ${cp.id}: startPoint=[${cp.startPoint.map(v => Math.round(v)).join(',')}] endPoint=[${cp.endPoint.map(v => Math.round(v)).join(',')}]`)
    }
  }

  let maxGap = 0
  for (let i = 1; i < roads.length; i++) {
    const prev = roads[i - 1]
    const curr = roads[i]
    if (prev.endPoint && curr.startPoint) {
      const dx = curr.startPoint[0] - prev.endPoint[0]
      const dz = curr.startPoint[2] - prev.endPoint[2]
      const gap = Math.sqrt(dx * dx + dz * dz)
      maxGap = Math.max(maxGap, gap)
    }
  }
  console.log(`  Max road centerline gap: ${maxGap.toFixed(2)}m`)

  const { maxEdgeGap, gapCount } = verifyEdgeGaps(roads)
  console.log(`  Max edge gap: ${maxEdgeGap.toFixed(4)}m (${gapCount} edges >0.1m)`)

  const { allOutside, badCount } = verifyBarrierPositions(barriers, roads)
  console.log(`  Barriers outside road: ${allOutside ? 'ALL OK' : `${badCount} within 3m of centerline (expected at crossovers/hairpins)`}`)

  const first = subdivided[0]
  const last = subdivided[subdivided.length - 1]
  const closureGap = dist2D(first, last)
  console.log(`  Closure gap: ${closureGap.toFixed(2)}m`)

  if (maxEdgeGap > 0.1) console.warn(`  WARNING: Edge gaps detected (${maxEdgeGap.toFixed(2)}m)`)
  if (maxSegLen > 50) console.warn(`  WARNING: Max segment length ${maxSegLen.toFixed(1)}m exceeds 50m`)
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: bun run scripts/convert-csv-track.ts <circuit-name>')
  console.log(`Available circuits: ${Object.keys(CSV_CIRCUITS).join(', ')}`)
  process.exit(0)
}

const circuitName = args[0].toLowerCase()
convertCsvCircuit(circuitName).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
