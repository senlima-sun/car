import { create } from 'zustand'

const DEFAULT_RESOLUTION = 256
const DEFAULT_WORLD_SIZE = 4000

export type BaselineSource = 'sidecar' | 'custom'

interface TerrainState {
  baseline: Float32Array
  delta: Float32Array
  /**
   * Derived roadbed offset layer (Phase 3 of roadbed-embedded-terrain).
   *
   * Composed height is `baseline + delta + roadbed`. The layer is
   * regenerated whenever ribbons or terrain change; it is NEVER
   * persisted. For preset tracks the stamp is already baked into the
   * sidecar baseline, so the layer is all zeros. For editor-authored
   * or sidecar-less tracks, it carries the cut/fill amount so visual,
   * heightfield, and surface queries see the same embedded roadbed
   * without modifying the user's authored terrain delta.
   */
  roadbed: Float32Array
  resolution: number
  worldSize: number
  terrainGeneration: number
  sidecarApplied: boolean
  customBaselineUsed: boolean
  deltaPresent: boolean
  roadbedPresent: boolean

  getHeightAt: (worldX: number, worldZ: number) => number
  getComposedHeightsSnapshot: () => Float32Array
  getHeightsArray: () => number[]

  replaceBaseline: (data: number[] | Float32Array, opts: { source: BaselineSource }) => void
  replaceDelta: (data: number[] | Float32Array) => void
  resetDelta: () => void
  resetBaseline: () => void
  replaceRoadbed: (data: number[] | Float32Array) => void
  resetRoadbed: () => void
  applyDeltaStroke: (
    changes: Map<number, number>,
    opts?: { deferGeneration?: boolean },
  ) => void
  commitGeneration: () => void

  /** @deprecated use replaceBaseline / replaceDelta. Removed in Phase 6.2. */
  loadHeightmap: (data: number[]) => void
  /** @deprecated use replaceDelta + resetBaseline or resetDelta. Removed in Phase 6.2. */
  resetHeightmap: () => void
  /** @deprecated use applyDeltaStroke. Removed in Phase 6.2. */
  applyBrushStroke: (changes: Map<number, number>, opts?: { deferVersion?: boolean }) => void
  /** @deprecated terrainGeneration drives both visual and physics; this is a no-op. Removed in Phase 6.2. */
  flushVisualVersion: () => void
  /** @deprecated terrainGeneration drives both visual and physics; this is a no-op. Removed in Phase 6.2. */
  commitPhysics: () => void
}

function copyInto(target: Float32Array, source: number[] | Float32Array): void {
  const len = Math.min(source.length, target.length)
  for (let i = 0; i < len; i++) target[i] = source[i]!
  for (let i = len; i < target.length; i++) target[i] = 0
}

function deltaPresentOf(delta: Float32Array): boolean {
  for (let i = 0; i < delta.length; i++) {
    if (delta[i] !== 0) return true
  }
  return false
}

export const useTerrainStore = create<TerrainState>((set, get) => ({
    baseline: new Float32Array(DEFAULT_RESOLUTION * DEFAULT_RESOLUTION),
    delta: new Float32Array(DEFAULT_RESOLUTION * DEFAULT_RESOLUTION),
    roadbed: new Float32Array(DEFAULT_RESOLUTION * DEFAULT_RESOLUTION),
    resolution: DEFAULT_RESOLUTION,
    worldSize: DEFAULT_WORLD_SIZE,
    terrainGeneration: 0,
    sidecarApplied: false,
    customBaselineUsed: false,
    deltaPresent: false,
    roadbedPresent: false,

    getHeightAt: (worldX, worldZ) => {
      const { baseline, delta, roadbed, resolution, worldSize } = get()
      const halfSize = worldSize / 2
      const cellSize = worldSize / (resolution - 1)
      const fxRaw = (worldX + halfSize) / cellSize
      const fzRaw = (worldZ + halfSize) / cellSize
      const maxIdx = resolution - 1.0001
      const fx = fxRaw < 0 ? 0 : fxRaw > maxIdx ? maxIdx : fxRaw
      const fz = fzRaw < 0 ? 0 : fzRaw > maxIdx ? maxIdx : fzRaw
      const gx = Math.floor(fx)
      const gz = Math.floor(fz)
      const tx = fx - gx
      const tz = fz - gz
      const idx00 = gz * resolution + gx
      const idx10 = idx00 + 1
      const idx01 = idx00 + resolution
      const idx11 = idx01 + 1
      const h00 = baseline[idx00]! + delta[idx00]! + roadbed[idx00]!
      const h10 = baseline[idx10]! + delta[idx10]! + roadbed[idx10]!
      const h01 = baseline[idx01]! + delta[idx01]! + roadbed[idx01]!
      const h11 = baseline[idx11]! + delta[idx11]! + roadbed[idx11]!
      const h0 = h00 + (h10 - h00) * tx
      const h1 = h01 + (h11 - h01) * tx
      return h0 + (h1 - h0) * tz
    },

    getComposedHeightsSnapshot: () => {
      const { baseline, delta, roadbed, resolution } = get()
      const out = new Float32Array(resolution * resolution)
      for (let i = 0; i < out.length; i++) out[i] = baseline[i]! + delta[i]! + roadbed[i]!
      return out
    },

    getHeightsArray: () => {
      const snapshot = get().getComposedHeightsSnapshot()
      return Array.from(snapshot)
    },

    replaceBaseline: (data, opts) => {
      const { resolution } = get()
      const baseline = new Float32Array(resolution * resolution)
      copyInto(baseline, data)
      set(state => ({
        baseline,
        sidecarApplied: opts.source === 'sidecar',
        customBaselineUsed: opts.source === 'custom',
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    replaceDelta: data => {
      const { resolution } = get()
      const delta = new Float32Array(resolution * resolution)
      copyInto(delta, data)
      set(state => ({
        delta,
        deltaPresent: deltaPresentOf(delta),
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    resetDelta: () => {
      const { resolution } = get()
      set(state => ({
        delta: new Float32Array(resolution * resolution),
        deltaPresent: false,
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    resetBaseline: () => {
      const { resolution } = get()
      set(state => ({
        baseline: new Float32Array(resolution * resolution),
        sidecarApplied: false,
        customBaselineUsed: false,
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    replaceRoadbed: data => {
      const { resolution } = get()
      const roadbed = new Float32Array(resolution * resolution)
      copyInto(roadbed, data)
      set(state => ({
        roadbed,
        roadbedPresent: deltaPresentOf(roadbed),
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    resetRoadbed: () => {
      const { resolution } = get()
      set(state => ({
        roadbed: new Float32Array(resolution * resolution),
        roadbedPresent: false,
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    applyDeltaStroke: (changes, opts) => {
      const { baseline, delta } = get()
      for (const [index, targetAbsolute] of changes) {
        if (index < 0 || index >= delta.length) continue
        delta[index] = targetAbsolute - baseline[index]!
      }
      if (!opts?.deferGeneration) {
        set(state => ({
          deltaPresent: deltaPresentOf(delta),
          terrainGeneration: state.terrainGeneration + 1,
        }))
      }
    },

    commitGeneration: () => {
      set(state => ({
        deltaPresent: deltaPresentOf(state.delta),
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    loadHeightmap: data => {
      const { resolution } = get()
      const delta = new Float32Array(resolution * resolution)
      copyInto(delta, data)
      const baseline = new Float32Array(resolution * resolution)
      set(state => ({
        baseline,
        delta,
        sidecarApplied: false,
        customBaselineUsed: false,
        deltaPresent: deltaPresentOf(delta),
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    resetHeightmap: () => {
      const { resolution } = get()
      set(state => ({
        baseline: new Float32Array(resolution * resolution),
        delta: new Float32Array(resolution * resolution),
        sidecarApplied: false,
        customBaselineUsed: false,
        deltaPresent: false,
        terrainGeneration: state.terrainGeneration + 1,
      }))
    },

    applyBrushStroke: (changes, opts) => {
      get().applyDeltaStroke(changes, { deferGeneration: opts?.deferVersion })
    },

    flushVisualVersion: () => {
      get().commitGeneration()
    },

    commitPhysics: () => {
      // no-op: terrainGeneration is the single SSoT driving both visual and physics
    },
  }))

const composedReadbackBuffer = new Float32Array(DEFAULT_RESOLUTION * DEFAULT_RESOLUTION)
function readComposedInPlace(state: TerrainState): Float32Array {
  for (let i = 0; i < composedReadbackBuffer.length; i++) {
    composedReadbackBuffer[i] = state.baseline[i]! + state.delta[i]! + state.roadbed[i]!
  }
  return composedReadbackBuffer
}

export const selectComposedHeightmap = (state: TerrainState): Float32Array =>
  readComposedInPlace(state)

export const selectTerrainVersion = (state: TerrainState): number => state.terrainGeneration
