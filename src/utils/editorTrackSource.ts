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
import { PAINTED_WIDTH, TRACK_EDGE_LINE_WIDTH, TRACK_WIDTH } from '@/constants/dimensions'
import { CURB_WIDTH } from '@/constants/curb'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { realignCheckpointToRibbons } from '@/utils/checkpointAlignment'
import { bezierTToArcT } from '@/utils/bezierToArcT'
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
  schemaVersion?: number
}

export const CURRENT_TRACK_SCHEMA_VERSION = 1

export function validateSchemaVersion(source: EditorTrackSource): void {
  if (
    source.schemaVersion !== undefined &&
    source.schemaVersion > CURRENT_TRACK_SCHEMA_VERSION
  ) {
    console.warn(
      `[track] "${source.id}" has schemaVersion=${source.schemaVersion}, this runtime supports up to ${CURRENT_TRACK_SCHEMA_VERSION}. Forward-compat fields may be ignored.`,
    )
  }
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
  ribbons: PlacedObject[],
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

  let startPoint: [number, number, number] = [startX, terrainHeightAt(startX, startZ), startZ]
  let endPoint: [number, number, number] = [endX, terrainHeightAt(endX, endZ), endZ]
  let rotation = Math.atan2(tangent.x, tangent.y)
  let position: [number, number, number] = [point.x, centerY, point.y]

  const desiredDirection: [number, number, number] = [tangent.x, 0, tangent.y]
  const realigned = realignCheckpointToRibbons(position, desiredDirection, TRACK_WIDTH, ribbons)
  if (realigned) {
    const sx = realigned.startPoint[0]
    const sz = realigned.startPoint[2]
    const ex = realigned.endPoint[0]
    const ez = realigned.endPoint[2]
    startPoint = [sx, terrainHeightAt(sx, sz), sz]
    endPoint = [ex, terrainHeightAt(ex, ez), ez]
    position = [
      realigned.midpoint[0],
      terrainHeightAt(realigned.midpoint[0], realigned.midpoint[2]),
      realigned.midpoint[2],
    ]
    rotation = realigned.rotation
  }

  return {
    id: genId('cp'),
    type: 'checkpoint',
    position,
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

function paintedAreaForRibbon(
  path: Path,
  ribbon: PlacedObject,
  side: 'left' | 'right',
  width: number,
  innerOffset: number,
  pathStart?: number,
  pathEnd?: number,
  idPrefix: string = 'painted',
  allPaths?: Path[],
): PlacedObject | null {
  const segCount = segmentCount(path)
  if (segCount === 0) return null

  let tRange: [number, number] | undefined
  if (pathStart !== undefined && pathEnd !== undefined) {
    const lo = Math.max(0, Math.min(pathStart, pathEnd))
    const hi = Math.min(segCount, Math.max(pathStart, pathEnd))
    if (hi - lo < 1e-4) return null
    const paths = allPaths ?? [path]
    const tStart = bezierTToArcT(path, lo, paths)
    const tEnd = bezierTToArcT(path, hi, paths)
    tRange = [tStart, tEnd]
  }

  return {
    id: genId(idPrefix),
    type: 'painted_area',
    position: ribbon.position,
    rotation: 0,
    parentRibbonId: ribbon.id,
    parentSide: side,
    innerOffset,
    derivedWidth: width,
    width,
    edgeSide: side,
    tRange,
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

  const edgeLineObjects: PlacedObject[] = []
  for (const ribbon of ribbons) {
    for (const side of ['left', 'right'] as const) {
      edgeLineObjects.push({
        id: genId('edge'),
        type: 'edge_line',
        position: ribbon.position,
        rotation: 0,
        parentRibbonId: ribbon.id,
        parentSide: side,
        innerOffset: -TRACK_EDGE_LINE_WIDTH,
        derivedWidth: TRACK_EDGE_LINE_WIDTH,
        width: TRACK_EDGE_LINE_WIDTH,
      })
    }
  }

  const checkpointObjects: PlacedObject[] = []
  let sectorOrder = 0
  for (const checkpoint of input.checkpoints) {
    const order = checkpoint.kind === 'sector' ? ++sectorOrder : 0
    const object = checkpointToPlacedObject(
      checkpoint,
      order,
      input.paths,
      input.raceDirection,
      ribbons,
    )
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
  for (let i = 0; i < input.paths.length; i++) {
    const path = input.paths[i]!
    const ribbon = ribbons[i]
    if (!ribbon) continue

    const left = paintedAreaForRibbon(path, ribbon, 'left', PAINTED_WIDTH, CURB_WIDTH)
    if (left) paintedObjects.push(left)
    const right = paintedAreaForRibbon(path, ribbon, 'right', PAINTED_WIDTH, CURB_WIDTH)
    if (right) paintedObjects.push(right)

    for (const side of ['left', 'right'] as const) {
      for (const gap of curbBandGapsForPath(path, side, curbs)) {
        const apron = paintedAreaForRibbon(
          path,
          ribbon,
          side,
          CURB_WIDTH,
          0,
          gap.start,
          gap.end,
          'painted_apron',
          input.paths,
        )
        if (apron) apronObjects.push(apron)
      }
    }
  }
  return [
    ...ribbons,
    ...edgeLineObjects,
    ...checkpointObjects,
    ...pitBoxObjects,
    ...paintedObjects,
    ...apronObjects,
    ...curbObjects,
  ]
}

export function buildRuntimePresetTrack(source: EditorTrackSource): RuntimePresetTrack {
  validateSchemaVersion(source)
  return {
    id: source.id,
    name: source.name,
    trackLength: source.trackLength,
    turns: source.turns,
    objects: buildTrackObjectsFromEditorSource(source),
  }
}
