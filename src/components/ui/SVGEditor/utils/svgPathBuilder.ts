import type { PlacedObject } from '@/types/trackObjects'
import { isCurveMode, isLinearObject, isPolygonObject } from '@/types/trackObjects'
import { getRoadEdgePositionAt } from '@/utils/roadGeometry'
import { ROAD_HALF_WIDTH, WALL_WIDTH } from '@/constants/dimensions'
import { OBJECT_CONFIGS, PIT_ROAD_WIDTH } from '@/constants/trackObjects'

function worldToSVG(x: number, z: number): [number, number] {
  return [x, -z]
}

export function buildLinearPath(obj: PlacedObject): string {
  if (!obj.startPoint || !obj.endPoint) return ''

  const [sx, sy] = worldToSVG(obj.startPoint[0], obj.startPoint[2])
  const [ex, ey] = worldToSVG(obj.endPoint[0], obj.endPoint[2])

  if (isCurveMode(obj.trackMode) && obj.controlPoint) {
    const [cx, cy] = worldToSVG(obj.controlPoint[0], obj.controlPoint[2])
    return `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`
  }

  return `M ${sx} ${sy} L ${ex} ${ey}`
}

export function buildCurbPath(curb: PlacedObject, parentRoad: PlacedObject): string {
  if (!curb.edgeSide || curb.startT == null || curb.endT == null) return ''
  if (!parentRoad.startPoint || !parentRoad.endPoint) return ''

  const isPitRoadType =
    parentRoad.trackMode === 'pitroad' || parentRoad.trackMode === 'pitroad-curve'
  const halfWidth = isPitRoadType ? PIT_ROAD_WIDTH / 2 : ROAD_HALF_WIDTH

  const samples = 16
  const startT = Math.min(curb.startT, curb.endT)
  const endT = Math.max(curb.startT, curb.endT)
  const parts: string[] = []

  for (let i = 0; i <= samples; i++) {
    const t = startT + (endT - startT) * (i / samples)
    const pos = getRoadEdgePositionAt(parentRoad, curb.edgeSide, t, halfWidth)
    const [sx, sy] = worldToSVG(pos[0], pos[2])
    parts.push(i === 0 ? `M ${sx} ${sy}` : `L ${sx} ${sy}`)
  }

  return parts.join(' ')
}

export function buildCheckpointPath(obj: PlacedObject): string {
  if (!obj.startPoint || !obj.endPoint) return ''

  const [sx, sy] = worldToSVG(obj.startPoint[0], obj.startPoint[2])
  const [ex, ey] = worldToSVG(obj.endPoint[0], obj.endPoint[2])

  return `M ${sx} ${sy} L ${ex} ${ey}`
}

export function buildPolygonPath(obj: PlacedObject): string {
  if (!obj.polygonPoints || obj.polygonPoints.length < 3) return ''

  const parts = obj.polygonPoints.map((p, i) => {
    const [sx, sy] = worldToSVG(p[0], p[2])
    return i === 0 ? `M ${sx} ${sy}` : `L ${sx} ${sy}`
  })
  parts.push('Z')

  return parts.join(' ')
}

export function getPointObjectCenter(obj: PlacedObject): [number, number] {
  return worldToSVG(obj.position[0], obj.position[2])
}

export function getPointObjectRadius(obj: PlacedObject): number {
  const config = OBJECT_CONFIGS[obj.type]
  return Math.max(config.defaultSize.width, config.defaultSize.depth) / 2
}

export function getStrokeWidth(obj: PlacedObject): number {
  if (obj.type === 'road') {
    const isPit = obj.trackMode === 'pitroad' || obj.trackMode === 'pitroad-curve'
    return isPit ? PIT_ROAD_WIDTH : ROAD_HALF_WIDTH * 2
  }
  if (obj.type === 'barrier') return OBJECT_CONFIGS.barrier.defaultSize.width
  if (obj.type === 'wall' || obj.type === 'wall_fence') return WALL_WIDTH
  return 0.5
}

export function buildObjectPath(obj: PlacedObject, parentRoad?: PlacedObject): string {
  if (obj.type === 'curb' && parentRoad) {
    return buildCurbPath(obj, parentRoad)
  }

  if (isLinearObject(obj.type)) {
    return buildLinearPath(obj)
  }

  if (obj.type === 'checkpoint') {
    return buildCheckpointPath(obj)
  }

  if (isPolygonObject(obj.type)) {
    return buildPolygonPath(obj)
  }

  return ''
}
