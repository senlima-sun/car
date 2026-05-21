import { useTerrainStore } from '../stores/useTerrainStore'

export type TrackSurfaceMaterial = 'asphalt' | 'shoulder' | 'offroad'

export interface TrackSurfacePoint {
  /** Composed terrain height at (worldX, worldZ), including the
   *  embedded roadbed cut/fill layer. */
  height: number
  /** Upward normal sampled from finite differences against the
   *  composed terrain grid. */
  normal: [number, number, number]
  /** Coarse material classification derived from the magnitude of the
   *  roadbed layer at that cell: non-zero ⇒ inside the road footprint. */
  material: TrackSurfaceMaterial
  /** Absolute roadbed offset (m) at the query cell — useful as a
   *  cheap "how strongly is this a road cell" signal for downstream
   *  consumers. */
  roadbedMagnitude: number
}

const MATERIAL_THRESHOLD_M = 0.001
const SHOULDER_THRESHOLD_M = 0.02

export function queryTrackSurface(worldX: number, worldZ: number): TrackSurfacePoint {
  const state = useTerrainStore.getState()
  const { roadbed, resolution, worldSize } = state
  const halfSize = worldSize / 2
  const cellSize = worldSize / (resolution - 1)
  const fx = (worldX + halfSize) / cellSize
  const fz = (worldZ + halfSize) / cellSize
  if (fx < 0 || fx >= resolution - 1 || fz < 0 || fz >= resolution - 1) {
    return {
      height: 0,
      normal: [0, 1, 0],
      material: 'offroad',
      roadbedMagnitude: 0,
    }
  }
  const gx = Math.floor(fx)
  const gz = Math.floor(fz)
  const idx00 = gz * resolution + gx
  const roadbedHere = Math.abs(roadbed[idx00] ?? 0)

  // Central differences over the composed grid for an upward normal.
  const eps = cellSize
  const hC = state.getHeightAt(worldX, worldZ)
  const hX = state.getHeightAt(worldX + eps, worldZ)
  const hZ = state.getHeightAt(worldX, worldZ + eps)
  const dx = (hX - hC) / eps
  const dz = (hZ - hC) / eps
  const nx = -dx
  const ny = 1
  const nz = -dz
  const len = Math.hypot(nx, ny, nz) || 1
  let material: TrackSurfaceMaterial
  if (roadbedHere >= SHOULDER_THRESHOLD_M) material = 'asphalt'
  else if (roadbedHere >= MATERIAL_THRESHOLD_M) material = 'shoulder'
  else material = 'offroad'

  return {
    height: hC,
    normal: [nx / len, ny / len, nz / len],
    material,
    roadbedMagnitude: roadbedHere,
  }
}
