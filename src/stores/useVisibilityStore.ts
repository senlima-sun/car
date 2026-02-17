import { create } from 'zustand'
import { TrackSpatialGrid } from '../utils/trackSpatialGrid'
import type { PlacedObject } from '../types/trackObjects'
import type { QualityTier } from './usePerformanceStore'

interface TierConfig {
  base: number
  forwardMax: number
  behindMultiplier: number
  lateralMultiplier: number
}

const TIER_DISTANCES: Record<QualityTier, TierConfig> = {
  ultra: { base: 500, forwardMax: 250, behindMultiplier: 0.5, lateralMultiplier: 0.8 },
  high: { base: 400, forwardMax: 200, behindMultiplier: 0.4, lateralMultiplier: 0.7 },
  medium: { base: 250, forwardMax: 150, behindMultiplier: 0.35, lateralMultiplier: 0.6 },
  low: { base: 150, forwardMax: 100, behindMultiplier: 0.3, lateralMultiplier: 0.5 },
}

const HYSTERESIS_MARGIN = 30
const CHECKPOINT_FORCE_RANGE = 500
const MAX_SPEED_KMH = 330

const HEADING_THRESHOLD = 0.15
const POSITION_THRESHOLD_SQ = 25
const SPEED_SCALE_START = 80
const SPEED_SCALE_END = 300

let lastHeading = NaN
let lastPosX = NaN
let lastPosZ = NaN

interface VisibilityState {
  visibleObjectIds: Set<string>
  grid: TrackSpatialGrid | null
  rebuildGrid: (objects: PlacedObject[]) => void
  updateVisibility: (
    viewerX: number,
    viewerZ: number,
    heading: number,
    speedKmh: number,
    isEditor: boolean,
    editorDistance: number,
    tier: QualityTier,
    objects: PlacedObject[],
  ) => void
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

export const useVisibilityStore = create<VisibilityState>((set, get) => ({
  visibleObjectIds: new Set<string>(),
  grid: null,

  rebuildGrid(objects) {
    const grid = new TrackSpatialGrid()
    grid.rebuild(objects)
    set({ grid })
  },

  updateVisibility(viewerX, viewerZ, heading, speedKmh, isEditor, editorDistance, tier, objects) {
    const { grid, visibleObjectIds: prevIds } = get()
    if (!grid) return

    if (!isEditor && !Number.isNaN(lastHeading)) {
      const speedT = Math.min(
        Math.max((speedKmh - SPEED_SCALE_START) / (SPEED_SCALE_END - SPEED_SCALE_START), 0),
        1,
      )
      const hThresh = HEADING_THRESHOLD * (1 - speedT * 0.7)
      const pThreshSq = POSITION_THRESHOLD_SQ * (1 - speedT * 0.8)

      const dHeading = Math.abs(heading - lastHeading)
      const normalizedDHeading = dHeading > Math.PI ? 2 * Math.PI - dHeading : dHeading
      const dx = viewerX - lastPosX
      const dz = viewerZ - lastPosZ
      const distSq = dx * dx + dz * dz
      if (normalizedDHeading < hThresh && distSq < pThreshSq) {
        return
      }
    }
    lastHeading = heading
    lastPosX = viewerX
    lastPosZ = viewerZ

    const newIds = new Set<string>()

    if (isEditor) {
      const radius = Math.max(200, editorDistance * 2.5)
      const cellRange = Math.ceil(radius / 50)
      const vcx = Math.floor(viewerX / 50)
      const vcz = Math.floor(viewerZ / 50)
      const r2 = radius * radius

      for (let dx = -cellRange; dx <= cellRange; dx++) {
        for (let dz = -cellRange; dz <= cellRange; dz++) {
          const wx = (vcx + dx + 0.5) * 50
          const wz = (vcz + dz + 0.5) * 50
          const ddx = wx - viewerX
          const ddz = wz - viewerZ
          if (ddx * ddx + ddz * ddz <= r2) {
            const entries = grid.getCellEntries(`${vcx + dx},${vcz + dz}`)
            for (const e of entries) {
              newIds.add(e.objectId)
            }
          }
        }
      }
    } else {
      const cfg = TIER_DISTANCES[tier]
      const speedFactor = Math.min(speedKmh / MAX_SPEED_KMH, 1)
      const forwardDist = cfg.base + speedFactor * cfg.forwardMax
      const behindDist = cfg.base * cfg.behindMultiplier
      const lateralDist = cfg.base * cfg.lateralMultiplier

      const cellKeys = grid.queryCellsInEllipse(
        viewerX,
        viewerZ,
        heading,
        forwardDist,
        behindDist,
        lateralDist,
      )

      for (const key of cellKeys) {
        const entries = grid.getCellEntries(key)
        for (const e of entries) {
          newIds.add(e.objectId)
        }
      }

      for (const id of prevIds) {
        if (newIds.has(id)) continue
        const pos = grid.getObjectPosition(id)
        if (!pos) continue

        const dx = pos.x - viewerX
        const dz = pos.z - viewerZ

        const cosH = Math.cos(heading)
        const sinH = Math.sin(heading)
        const forward = dx * sinH + dz * cosH
        const lateral = dx * cosH - dz * sinH

        const fDist =
          forward >= 0 ? forwardDist + HYSTERESIS_MARGIN : behindDist + HYSTERESIS_MARGIN
        const lDist = lateralDist + HYSTERESIS_MARGIN

        const nf = forward / fDist
        const nl = lateral / lDist
        if (nf * nf + nl * nl <= 1) {
          newIds.add(id)
        }
      }

      for (const obj of objects) {
        if (obj.type !== 'checkpoint') continue
        const pos = grid.getObjectPosition(obj.id)
        if (!pos) continue
        const dx = pos.x - viewerX
        const dz = pos.z - viewerZ
        if (dx * dx + dz * dz <= CHECKPOINT_FORCE_RANGE * CHECKPOINT_FORCE_RANGE) {
          newIds.add(obj.id)
        }
      }
    }

    for (const id of newIds) {
      const children = grid.getChildIds(id)
      for (const childId of children) {
        newIds.add(childId)
      }
    }

    if (!setsEqual(prevIds, newIds)) {
      set({ visibleObjectIds: newIds })
    }
  },
}))
