import { closestPointOnAnyPath } from '../geometry/closestPoint'
import { makeAnchor, makePath } from '../geometry/path'
import type {
  CheckpointMarker,
  EditorDocument,
  Path,
  PitBoxArea,
  Point,
  RaceDirection,
} from '../geometry/types'
import type { Viewport } from '../geometry/viewport'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'

const ANCHOR_SPACING = 24
const VIEWPORT_PADDING = 120
const MIN_ZOOM = 0.05
const MAX_ZOOM = 4
const SHARP_TURN_DOT = 0.5

export type ImportedTrackEditorState = {
  doc: EditorDocument
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas: PitBoxArea[]
}

function ribbonPointToEditorPoint(point: TrackRibbonPoint): Point {
  return { x: point.x, y: point.z }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalize(x: number, y: number): Point {
  const length = Math.hypot(x, y)
  if (length < 1e-9) return { x: 0, y: 0 }
  return { x: x / length, y: y / length }
}

function pointEquals(a: Point, b: Point, epsilon = 1e-6): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon
}

function sampleRibbonIndices(points: TrackRibbonPoint[], closed: boolean): number[] {
  if (points.length <= 1) return points.map((_, index) => index)

  const indices = [0]
  let travelled = 0

  for (let index = 1; index < points.length; index++) {
    travelled += distance(
      ribbonPointToEditorPoint(points[index - 1]!),
      ribbonPointToEditorPoint(points[index]!),
    )

    if (travelled >= ANCHOR_SPACING) {
      indices.push(index)
      travelled = 0
    }
  }

  const lastIndex = points.length - 1
  if (!closed && indices[indices.length - 1] !== lastIndex) {
    indices.push(lastIndex)
  }

  if (closed && indices.length < 3) {
    return Array.from(
      new Set([0, Math.floor(points.length / 3), Math.floor((points.length * 2) / 3)]),
    )
      .filter(index => index >= 0 && index < points.length)
      .sort((a, b) => a - b)
  }

  return Array.from(new Set(indices))
}

function isSharpTurn(prev: Point, current: Point, next: Point): boolean {
  const incoming = normalize(current.x - prev.x, current.y - prev.y)
  const outgoing = normalize(next.x - current.x, next.y - current.y)
  const dot = incoming.x * outgoing.x + incoming.y * outgoing.y
  return dot < SHARP_TURN_DOT
}

function assignSegmentHandles(
  anchors: ReturnType<typeof makeAnchor>[],
  fromIndex: number,
  toIndex: number,
  closed: boolean,
): void {
  const count = anchors.length
  const from = anchors[fromIndex]!
  const to = anchors[toIndex]!
  const prevIndex = fromIndex === 0 ? (closed ? count - 1 : fromIndex) : fromIndex - 1
  const nextIndex = toIndex === count - 1 ? (closed ? 0 : toIndex) : toIndex + 1
  const prev = anchors[prevIndex]!
  const next = anchors[nextIndex]!

  if (isSharpTurn(prev.point, from.point, to.point)) {
    from.outHandle = { ...from.point }
    from.handleType = 'corner'
  } else {
    from.outHandle = {
      x: from.point.x + (to.point.x - prev.point.x) / 6,
      y: from.point.y + (to.point.y - prev.point.y) / 6,
    }
    from.handleType = 'smooth'
  }

  if (isSharpTurn(from.point, to.point, next.point)) {
    to.inHandle = { ...to.point }
    to.handleType = 'corner'
  } else {
    to.inHandle = {
      x: to.point.x - (next.point.x - from.point.x) / 6,
      y: to.point.y - (next.point.y - from.point.y) / 6,
    }
    to.handleType = 'smooth'
  }
}

function collectPitLaneSegments(
  points: TrackRibbonPoint[],
  sampledIndices: number[],
  closed: boolean,
): number[] | undefined {
  if (sampledIndices.length < 2) return undefined

  const marked: number[] = []
  const segmentCount = closed ? sampledIndices.length : sampledIndices.length - 1

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
    const startIndex = sampledIndices[segmentIndex]!
    const endIndex =
      segmentIndex === sampledIndices.length - 1
        ? sampledIndices[0]!
        : sampledIndices[segmentIndex + 1]!

    let pitSegments = 0
    let totalSegments = 0

    if (segmentIndex === sampledIndices.length - 1 && closed) {
      for (let index = startIndex; index < points.length - 1; index++) {
        totalSegments++
        if (points[index]!.isPitLane && points[index + 1]!.isPitLane) pitSegments++
      }
      totalSegments++
      if (points[points.length - 1]!.isPitLane && points[0]!.isPitLane) pitSegments++
      for (let index = 0; index < endIndex; index++) {
        totalSegments++
        if (points[index]!.isPitLane && points[index + 1]!.isPitLane) pitSegments++
      }
    } else {
      for (let index = startIndex; index < endIndex; index++) {
        totalSegments++
        if (points[index]!.isPitLane && points[index + 1]!.isPitLane) pitSegments++
      }
    }

    if (totalSegments > 0 && pitSegments / totalSegments >= 0.5) {
      marked.push(segmentIndex)
    }
  }

  return marked.length > 0 ? marked : undefined
}

function ribbonToPath(object: PlacedObject): Path | null {
  if (object.type !== 'track_ribbon' || !object.ribbonPoints || object.ribbonPoints.length < 2) {
    return null
  }

  const closed = object.ribbonClosed ?? false
  const sampledIndices = sampleRibbonIndices(object.ribbonPoints, closed)
  if (sampledIndices.length < (closed ? 3 : 2)) return null

  const anchors = sampledIndices.map(index =>
    makeAnchor(ribbonPointToEditorPoint(object.ribbonPoints![index]!)),
  )
  const segmentCount = closed ? anchors.length : anchors.length - 1

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
    const nextIndex = (segmentIndex + 1) % anchors.length
    assignSegmentHandles(anchors, segmentIndex, nextIndex, closed)
  }

  const path = makePath()
  path.anchors = anchors
  path.closed = closed
  path.pitLaneSegments = collectPitLaneSegments(object.ribbonPoints, sampledIndices, closed)
  return path
}

function checkpointKindOf(object: PlacedObject): 'start-finish' | 'sector' {
  return object.checkpointType === 'sector' ? 'sector' : 'start-finish'
}

function trackObjectPositionToEditorPoint(object: PlacedObject): Point {
  return { x: object.position[0], y: object.position[2] }
}

export function importTrackObjectsToEditorState(objects: PlacedObject[]): ImportedTrackEditorState {
  const paths = objects
    .filter(object => object.type === 'track_ribbon')
    .map(ribbonToPath)
    .filter((path): path is Path => path !== null)

  const checkpoints = objects
    .filter(object => object.type === 'checkpoint')
    .map(object => {
      const closest = closestPointOnAnyPath(paths, trackObjectPositionToEditorPoint(object), paths)
      if (!closest) return null

      return {
        id: object.id,
        kind: checkpointKindOf(object),
        pathId: closest.pathId,
        segmentIndex: closest.segmentIndex,
        t: closest.t,
      } satisfies CheckpointMarker
    })
    .filter((checkpoint): checkpoint is CheckpointMarker => checkpoint !== null)

  const pitBoxAreas = objects
    .filter(object => object.type === 'pitbox')
    .map(
      object =>
        ({
          id: object.id,
          position: trackObjectPositionToEditorPoint(object),
          rotation: object.rotation,
        }) satisfies PitBoxArea,
    )

  const raceDirection =
    objects.find(object => object.type === 'checkpoint' && object.flowDirection)?.flowDirection ??
    objects.find(object => object.type === 'track_ribbon' && object.flowDirection)?.flowDirection ??
    'forward'

  return {
    doc: { paths },
    checkpoints,
    raceDirection,
    pitBoxAreas,
  }
}

function collectBounds(
  doc: EditorDocument,
  pitBoxAreas: PitBoxArea[],
): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} | null {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let hasPoint = false

  for (const path of doc.paths) {
    for (const slot of path.anchors) {
      if ('kind' in slot) continue
      minX = Math.min(minX, slot.point.x)
      maxX = Math.max(maxX, slot.point.x)
      minY = Math.min(minY, slot.point.y)
      maxY = Math.max(maxY, slot.point.y)
      hasPoint = true
    }
  }

  for (const area of pitBoxAreas) {
    minX = Math.min(minX, area.position.x)
    maxX = Math.max(maxX, area.position.x)
    minY = Math.min(minY, area.position.y)
    maxY = Math.max(maxY, area.position.y)
    hasPoint = true
  }

  if (!hasPoint) return null
  return { minX, maxX, minY, maxY }
}

export function fitViewportToEditorState(
  state: ImportedTrackEditorState,
  screenWidth: number,
  screenHeight: number,
): Viewport {
  const bounds = collectBounds(state.doc, state.pitBoxAreas)
  if (!bounds) {
    return {
      pan: { x: screenWidth / 2, y: screenHeight / 2 },
      zoom: 1,
    }
  }

  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const zoom = clamp(
    Math.min(
      Math.max(1, screenWidth - VIEWPORT_PADDING * 2) / width,
      Math.max(1, screenHeight - VIEWPORT_PADDING * 2) / height,
    ),
    MIN_ZOOM,
    MAX_ZOOM,
  )
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    zoom,
    pan: {
      x: screenWidth / 2 - centerX * zoom,
      y: screenHeight / 2 - centerY * zoom,
    },
  }
}

export function normalizePresetTrackObjects(objects: PlacedObject[]): PlacedObject[] {
  const direction =
    objects.find(object => object.type === 'checkpoint' && object.flowDirection)?.flowDirection ??
    objects.find(object => object.type === 'track_ribbon' && object.flowDirection)?.flowDirection ??
    'forward'

  return objects.map(object => {
    if (object.type === 'track_ribbon') {
      const ribbonClosed =
        object.ribbonClosed ??
        (object.ribbonPoints ? inferClosedRibbon(object.ribbonPoints) : false)
      if (object.flowDirection && object.ribbonClosed !== undefined) return object
      return {
        ...object,
        flowDirection: object.flowDirection ?? direction,
        ribbonClosed,
      }
    }

    if (object.type === 'checkpoint') {
      if (object.flowDirection) return object
      return { ...object, flowDirection: direction }
    }

    return object
  })
}

export function inferClosedRibbon(points: TrackRibbonPoint[]): boolean {
  if (points.length < 3) return false
  const first = ribbonPointToEditorPoint(points[0]!)
  const last = ribbonPointToEditorPoint(points[points.length - 1]!)
  return !pointEquals(first, last) && distance(first, last) <= ANCHOR_SPACING / 2
}
