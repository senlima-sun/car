import { pointOnPath } from '@/components/ui/TrackEditor/geometry/closestPoint'
import type {
  CheckpointMarker,
  Path,
  PitBoxArea,
  RaceDirection,
} from '@/components/ui/TrackEditor/geometry/types'
import { documentToRibbons } from '@/components/ui/TrackEditor/export/pathToRibbon'
import { TRACK_WIDTH } from '@/constants/dimensions'
import type { PlacedObject } from '@/types/trackObjects'

export type EditorTrackDocument = {
  paths: Path[]
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas?: PitBoxArea[]
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
  const startPoint: [number, number, number] = [
    point.x - tangent.y * halfWidth,
    0,
    point.y + tangent.x * halfWidth,
  ]
  const endPoint: [number, number, number] = [
    point.x + tangent.y * halfWidth,
    0,
    point.y - tangent.x * halfWidth,
  ]
  const rotation = Math.atan2(tangent.x, tangent.y)

  return {
    id: genId('cp'),
    type: 'checkpoint',
    position: [point.x, 0, point.y],
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
    position: [area.position.x, 0, area.position.y],
    rotation: area.rotation,
  }
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
  return [...ribbons, ...checkpointObjects, ...pitBoxObjects]
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
