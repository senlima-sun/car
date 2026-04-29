import {
  pointOnPath,
  pointOnPathAt,
  segmentCount,
} from '@/components/ui/TrackEditor/geometry/closestPoint'
import type {
  CheckpointMarker,
  CurbMarker,
  Path,
  PitBoxArea,
  RaceDirection,
} from '@/components/ui/TrackEditor/geometry/types'
import { documentToRibbons } from '@/components/ui/TrackEditor/export/pathToRibbon'
import { PAINTED_WIDTH, TRACK_WIDTH } from '@/constants/dimensions'
import { CURB_WIDTH } from '@/constants/curb'
import { useTerrainStore } from '@/stores/useTerrainStore'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'

export type EditorTrackDocument = {
  paths: Path[]
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas?: PitBoxArea[]
  curbs?: CurbMarker[]
}

export type EditorTrackSource = {
  id: string
  name: string
  trackLength: number
  turns: number
  paths: Path[]
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas?: PitBoxArea[]
  curbs?: CurbMarker[]
}

export type RuntimePresetTrack = {
  id: string
  name: string
  trackLength: number
  turns: number
  objects: PlacedObject[]
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function terrainHeightAt(worldX: number, worldZ: number): number {
  return useTerrainStore.getState().getHeightAt(worldX, worldZ)
}

function checkpointToPlacedObject(
  checkpoint: CheckpointMarker,
  order: number,
  paths: Path[],
  raceDirection: RaceDirection,
): PlacedObject | null {
  const path = paths.find(candidate => candidate.id === checkpoint.pathId)
  if (!path) return null

  const onPath = pointOnPath(path, checkpoint.segmentIndex, checkpoint.t)
  if (!onPath) return null

  const { point, tangent } = onPath
  const halfWidth = TRACK_WIDTH / 2
  const centerY = terrainHeightAt(point.x, point.y)
  const startX = point.x - tangent.y * halfWidth
  const startZ = point.y + tangent.x * halfWidth
  const endX = point.x + tangent.y * halfWidth
  const endZ = point.y - tangent.x * halfWidth
  const startPoint: [number, number, number] = [startX, terrainHeightAt(startX, startZ), startZ]
  const endPoint: [number, number, number] = [endX, terrainHeightAt(endX, endZ), endZ]
  const rotation = Math.atan2(tangent.x, tangent.y)

  return {
    id: genId('cp'),
    type: 'checkpoint',
    position: [point.x, centerY, point.y],
    rotation,
    startPoint,
    endPoint,
    checkpointType: checkpoint.kind,
    checkpointOrder: checkpoint.kind === 'sector' ? order : 0,
    width: TRACK_WIDTH,
    flowDirection: raceDirection,
  }
}

function pitBoxAreaToPlacedObject(area: PitBoxArea): PlacedObject {
  return {
    id: genId('pitbox'),
    type: 'pitbox',
    position: [area.position.x, terrainHeightAt(area.position.x, area.position.y), area.position.y],
    rotation: area.rotation,
  }
}

const CURB_SAMPLE_SPACING = 0.5

function curbMarkerToPlacedObject(curb: CurbMarker, paths: Path[]): PlacedObject | null {
  const path = paths.find(candidate => candidate.id === curb.pathId)
  if (!path) return null
  const lo = Math.min(curb.pathStart, curb.pathEnd)
  const hi = Math.max(curb.pathStart, curb.pathEnd)
  const span = hi - lo
  if (span < 1e-4) return null

  const sign = curb.edge === 'left' ? 1 : -1
  const halfTrack = TRACK_WIDTH / 2
  const offset = halfTrack + CURB_WIDTH / 2

  const samplesArr: TrackRibbonPoint[] = []
  let prev: { x: number; y: number } | null = null
  let approxLen = 0
  const probe = Math.max(16, Math.ceil(span * 16))
  for (let i = 0; i <= probe; i++) {
    const p = lo + (span * i) / probe
    const onPath = pointOnPathAt(path, p, paths)
    if (!onPath) continue
    if (prev) {
      approxLen += Math.hypot(onPath.point.x - prev.x, onPath.point.y - prev.y)
    }
    prev = onPath.point
  }
  const steps = Math.max(4, Math.ceil(approxLen / CURB_SAMPLE_SPACING))

  for (let i = 0; i <= steps; i++) {
    const p = lo + (span * i) / steps
    const onPath = pointOnPathAt(path, p, paths)
    if (!onPath) continue
    const wx = onPath.point.x + sign * -onPath.tangent.y * offset
    const wz = onPath.point.y + sign * onPath.tangent.x * offset
    samplesArr.push({
      x: wx,
      y: terrainHeightAt(wx, wz),
      z: wz,
      isPitLane: false,
    })
  }

  if (samplesArr.length < 2) return null

  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of samplesArr) {
    cx += p.x
    cy += p.y
    cz += p.z
  }
  const n = samplesArr.length
  return {
    id: genId('curb'),
    type: 'curb',
    position: [cx / n, cy / n, cz / n],
    rotation: 0,
    width: CURB_WIDTH,
    edgeSide: curb.edge,
    curbType: curb.variant,
    curbCenterline: samplesArr,
  }
}

const PAINTED_SAMPLE_SPACING = 1.0

function paintedAreaForPath(
  path: Path,
  side: 'left' | 'right',
  paths: Path[],
  width: number,
  innerOffset: number,
  pathStart: number = 0,
  pathEnd: number = segmentCount(path),
  idPrefix: string = 'painted',
): PlacedObject | null {
  const segCount = segmentCount(path)
  if (segCount === 0) return null
  const lo = Math.max(0, Math.min(pathStart, pathEnd))
  const hi = Math.min(segCount, Math.max(pathStart, pathEnd))
  const span = hi - lo
  if (span < 1e-4) return null

  const sign = side === 'left' ? 1 : -1
  const halfTrack = TRACK_WIDTH / 2
  const offset = halfTrack + innerOffset + width / 2

  let approxLen = 0
  let prev: { x: number; y: number } | null = null
  const probe = Math.max(32, Math.ceil(segCount * 32))
  for (let i = 0; i <= probe; i++) {
    const p = lo + (span * i) / probe
    const onPath = pointOnPathAt(path, p, paths)
    if (!onPath) continue
    if (prev) {
      approxLen += Math.hypot(onPath.point.x - prev.x, onPath.point.y - prev.y)
    }
    prev = onPath.point
  }
  const steps = Math.max(8, Math.ceil(approxLen / PAINTED_SAMPLE_SPACING))

  const samplesArr: TrackRibbonPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const p = lo + (span * i) / steps
    const onPath = pointOnPathAt(path, p, paths)
    if (!onPath) continue
    const wx = onPath.point.x + sign * -onPath.tangent.y * offset
    const wz = onPath.point.y + sign * onPath.tangent.x * offset
    samplesArr.push({
      x: wx,
      y: terrainHeightAt(wx, wz),
      z: wz,
      isPitLane: false,
    })
  }

  if (samplesArr.length < 2) return null

  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of samplesArr) {
    cx += p.x
    cy += p.y
    cz += p.z
  }
  const n = samplesArr.length
  return {
    id: genId(idPrefix),
    type: 'painted_area',
    position: [cx / n, cy / n, cz / n],
    rotation: 0,
    width,
    edgeSide: side,
    ribbonPoints: samplesArr,
    ribbonClosed: path.closed && lo === 0 && hi === segCount,
  }
}

function curbBandGapsForPath(
  path: Path,
  side: 'left' | 'right',
  curbs: CurbMarker[],
): Array<{ start: number; end: number }> {
  const segCount = segmentCount(path)
  const intervals = curbs
    .filter(curb => curb.pathId === path.id && curb.edge === side)
    .map(curb => ({
      start: Math.max(0, Math.min(curb.pathStart, curb.pathEnd)),
      end: Math.min(segCount, Math.max(curb.pathStart, curb.pathEnd)),
    }))
    .filter(interval => interval.end - interval.start >= 1e-4)
    .sort((a, b) => a.start - b.start)

  const gaps: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const interval of intervals) {
    if (interval.start > cursor + 1e-4) {
      gaps.push({ start: cursor, end: interval.start })
    }
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < segCount - 1e-4) {
    gaps.push({ start: cursor, end: segCount })
  }
  return gaps
}

export function buildTrackObjectsFromEditorSource(input: EditorTrackDocument): PlacedObject[] {
  const ribbons = documentToRibbons(input.paths)

  for (const ribbon of ribbons) {
    ribbon.flowDirection = input.raceDirection
  }

  const checkpointObjects: PlacedObject[] = []
  let sectorOrder = 0
  for (const checkpoint of input.checkpoints) {
    const order = checkpoint.kind === 'sector' ? ++sectorOrder : 0
    const object = checkpointToPlacedObject(checkpoint, order, input.paths, input.raceDirection)
    if (object) checkpointObjects.push(object)
  }

  const pitBoxObjects = (input.pitBoxAreas ?? []).map(pitBoxAreaToPlacedObject)
  const curbObjects: PlacedObject[] = []
  for (const curb of input.curbs ?? []) {
    const obj = curbMarkerToPlacedObject(curb, input.paths)
    if (obj) curbObjects.push(obj)
  }
  const paintedObjects: PlacedObject[] = []
  const apronObjects: PlacedObject[] = []
  const curbs = input.curbs ?? []
  for (const path of input.paths) {
    const left = paintedAreaForPath(path, 'left', input.paths, PAINTED_WIDTH, CURB_WIDTH)
    if (left) paintedObjects.push(left)
    const right = paintedAreaForPath(path, 'right', input.paths, PAINTED_WIDTH, CURB_WIDTH)
    if (right) paintedObjects.push(right)

    for (const side of ['left', 'right'] as const) {
      for (const gap of curbBandGapsForPath(path, side, curbs)) {
        const apron = paintedAreaForPath(
          path,
          side,
          input.paths,
          CURB_WIDTH,
          0,
          gap.start,
          gap.end,
          'painted_apron',
        )
        if (apron) apronObjects.push(apron)
      }
    }
  }
  return [
    ...ribbons,
    ...checkpointObjects,
    ...pitBoxObjects,
    ...paintedObjects,
    ...apronObjects,
    ...curbObjects,
  ]
}

export function buildRuntimePresetTrack(source: EditorTrackSource): RuntimePresetTrack {
  return {
    id: source.id,
    name: source.name,
    trackLength: source.trackLength,
    turns: source.turns,
    objects: buildTrackObjectsFromEditorSource(source),
  }
}
