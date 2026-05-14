import { makeAnchor } from '@/components/ui/TrackEditor/geometry/path'
import type {
  CheckpointMarker,
  Path,
  Point,
  RaceDirection,
} from '@/components/ui/TrackEditor/geometry/types'
import type { EditorTrackSource } from '@/utils/editorTrackSource'

export type PolylinePoint = {
  x: number
  z: number
}

type PolylineTrackConfig = {
  id: string
  name: string
  trackLength: number
  turns: number
  points: PolylinePoint[]
  sectorSplits: [number, number]
  startFinishFraction: number
  raceDirection?: RaceDirection
  closed?: boolean
}

const CLOSED_EPSILON = 5

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function toEditorPoint(point: PolylinePoint): Point {
  return { x: point.x, y: point.z }
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

function inferClosed(points: Point[]): boolean {
  if (points.length < 3) return false
  return dist(points[0]!, points[points.length - 1]!) <= CLOSED_EPSILON
}

function normalizePoints(points: Point[], closed?: boolean): { points: Point[]; closed: boolean } {
  const resolvedClosed = closed ?? inferClosed(points)
  if (!resolvedClosed) {
    return { points, closed: false }
  }

  const normalized =
    points.length > 1 && dist(points[0]!, points[points.length - 1]!) <= CLOSED_EPSILON
      ? points.slice(0, -1)
      : points

  return { points: normalized, closed: true }
}

function tangent(prev: Point, next: Point): Point {
  return { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 }
}

function buildPath(pathId: string, points: Point[], closed: boolean): Path {
  const anchors = points.map(point => makeAnchor(point))
  const count = anchors.length

  for (let index = 0; index < count; index++) {
    const anchor = anchors[index]!
    const isEndpoint = !closed && (index === 0 || index === count - 1)
    if (isEndpoint) {
      anchor.handleType = 'corner'
      anchor.inHandle = clonePoint(anchor.point)
      anchor.outHandle = clonePoint(anchor.point)
      continue
    }

    const prevIndex = index === 0 ? count - 1 : index - 1
    const nextIndex = index === count - 1 ? 0 : index + 1
    const direction = tangent(points[prevIndex]!, points[nextIndex]!)
    anchor.handleType = 'smooth'
    anchor.inHandle = {
      x: anchor.point.x - direction.x,
      y: anchor.point.y - direction.y,
    }
    anchor.outHandle = {
      x: anchor.point.x + direction.x,
      y: anchor.point.y + direction.y,
    }
  }

  return {
    id: pathId,
    anchors,
    closed,
    stroke: '#e5e7eb',
    strokeWidth: 1.5,
    fill: 'none',
  }
}

function segmentLengths(points: Point[], closed: boolean): number[] {
  const lengths: number[] = []
  const segmentCount = closed ? points.length : points.length - 1
  for (let index = 0; index < segmentCount; index++) {
    const nextIndex = index === points.length - 1 ? 0 : index + 1
    lengths.push(dist(points[index]!, points[nextIndex]!))
  }
  return lengths
}

function checkpointAtFraction(
  id: string,
  kind: 'start-finish' | 'sector',
  pathId: string,
  fraction: number,
  lengths: number[],
): CheckpointMarker {
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  const target = Math.max(0, Math.min(1, fraction)) * totalLength

  let traversed = 0
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!
    const next = traversed + length
    if (target <= next || index === lengths.length - 1) {
      const t = length <= 1e-9 ? 0 : (target - traversed) / length
      return {
        id,
        kind,
        pathId,
        segmentIndex: index,
        t: Math.max(0, Math.min(1, t)),
      }
    }
    traversed = next
  }

  return {
    id,
    kind,
    pathId,
    segmentIndex: Math.max(0, lengths.length - 1),
    t: 1,
  }
}

export function buildEditorTrackSourceFromPolyline(config: PolylineTrackConfig): EditorTrackSource {
  const editorPoints = config.points.map(toEditorPoint)
  const normalized = normalizePoints(editorPoints, config.closed)
  const pathId = `${config.id}_path_0`
  const path = buildPath(pathId, normalized.points, normalized.closed)
  const lengths = segmentLengths(normalized.points, normalized.closed)

  const checkpoints: CheckpointMarker[] = [
    checkpointAtFraction(
      `${config.id}_checkpoint_0`,
      'start-finish',
      pathId,
      config.startFinishFraction,
      lengths,
    ),
    checkpointAtFraction(
      `${config.id}_checkpoint_1`,
      'sector',
      pathId,
      config.sectorSplits[0],
      lengths,
    ),
    checkpointAtFraction(
      `${config.id}_checkpoint_2`,
      'sector',
      pathId,
      config.sectorSplits[1],
      lengths,
    ),
  ]

  return {
    id: config.id,
    name: config.name,
    trackLength: config.trackLength,
    turns: config.turns,
    paths: [path],
    checkpoints,
    raceDirection: config.raceDirection ?? 'forward',
    pitBoxAreas: [],
  }
}
