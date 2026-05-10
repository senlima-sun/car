import type {
  CheckpointMarker,
  CurbMarker,
  Path,
  PitBoxArea,
  RaceDirection,
} from '@/components/ui/TrackEditor/geometry/types'
import { isAnchorRefSlot } from '@/components/ui/TrackEditor/geometry/types'
import { pointOnPathAt, segmentCount } from '@/components/ui/TrackEditor/geometry/closestPoint'
import { downloadFile } from '@/telemetry/exportTelemetry'
import type { EditorTrackSource } from './editorTrackSource'

export interface ExportPresetInput {
  id: string
  name: string
  paths: Path[]
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas?: PitBoxArea[]
  curbs?: CurbMarker[]
}

const SAMPLES_PER_SEGMENT = 32
const MIN_SAMPLES = 32

function pathLength(path: Path, allPaths: Path[]): number {
  const segCount = segmentCount(path)
  if (segCount === 0) return 0
  const samples = Math.max(MIN_SAMPLES, segCount * SAMPLES_PER_SEGMENT)
  let total = 0
  let prev = pointOnPathAt(path, 0, allPaths)?.point
  if (!prev) return 0
  for (let i = 1; i <= samples; i++) {
    const t = (i / samples) * segCount
    const next = pointOnPathAt(path, t, allPaths)?.point
    if (!next) continue
    total += Math.hypot(next.x - prev.x, next.y - prev.y)
    prev = next
  }
  return total
}

function computeTrackLength(paths: Path[]): number {
  const closed = paths.filter(p => p.closed)
  const target = closed.length > 0 ? closed : paths
  let sum = 0
  for (const p of target) sum += pathLength(p, paths)
  return Math.round(sum)
}

function countTurns(paths: Path[]): number {
  let count = 0
  for (const path of paths) {
    if (!path.closed) continue
    for (const slot of path.anchors) {
      if (isAnchorRefSlot(slot)) continue
      if (slot.handleType !== 'corner') continue
      count += 1
    }
  }
  return count
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000

function roundPoint<T extends { x: number; y: number }>(p: T): T {
  return { ...p, x: round4(p.x), y: round4(p.y) }
}

function roundPath(path: Path): Path {
  return {
    ...path,
    anchors: path.anchors.map(slot =>
      isAnchorRefSlot(slot)
        ? slot
        : {
            ...slot,
            point: roundPoint(slot.point),
            inHandle: roundPoint(slot.inHandle),
            outHandle: roundPoint(slot.outHandle),
          },
    ),
  }
}

export function buildEditorTrackSource(input: ExportPresetInput): EditorTrackSource {
  const paths = input.paths.map(roundPath)
  const source: EditorTrackSource = {
    id: input.id,
    name: input.name,
    trackLength: computeTrackLength(input.paths),
    turns: countTurns(input.paths),
    paths,
    checkpoints: input.checkpoints,
    raceDirection: input.raceDirection,
  }
  if (input.pitBoxAreas && input.pitBoxAreas.length > 0) source.pitBoxAreas = input.pitBoxAreas
  if (input.curbs && input.curbs.length > 0) source.curbs = input.curbs
  return source
}

export function downloadEditorTrackSourceJson(source: EditorTrackSource): void {
  downloadFile(JSON.stringify(source, null, 2), `${source.id}.json`, 'application/json')
}
