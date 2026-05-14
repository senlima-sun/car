export type TerrainBrushType = 'raise' | 'lower' | 'flatten' | 'smooth'

export interface BrushParams {
  type: TerrainBrushType
  radius: number
  strength: number
  flattenTarget?: number
}

function falloff(distance: number, radius: number): number {
  const t = distance / radius
  if (t >= 1) return 0
  const s = 1 - t * t
  return s * s
}

export function computeBrushStroke(
  heightmap: Float32Array,
  resolution: number,
  worldSize: number,
  worldX: number,
  worldZ: number,
  params: BrushParams,
  dt: number,
): Map<number, number> {
  const changes = new Map<number, number>()
  const cellSize = worldSize / (resolution - 1)
  const halfSize = worldSize / 2

  const centerGx = (worldX + halfSize) / cellSize
  const centerGz = (worldZ + halfSize) / cellSize

  const radiusCells = params.radius / cellSize
  const minGx = Math.max(0, Math.floor(centerGx - radiusCells))
  const maxGx = Math.min(resolution - 1, Math.ceil(centerGx + radiusCells))
  const minGz = Math.max(0, Math.floor(centerGz - radiusCells))
  const maxGz = Math.min(resolution - 1, Math.ceil(centerGz + radiusCells))

  for (let gz = minGz; gz <= maxGz; gz++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const wx = gx * cellSize - halfSize
      const wz = gz * cellSize - halfSize
      const dx = wx - worldX
      const dz = wz - worldZ
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist > params.radius) continue

      const f = falloff(dist, params.radius)
      const index = gz * resolution + gx
      const h = heightmap[index]
      let newH = h

      switch (params.type) {
        case 'raise':
          newH = h + params.strength * f * dt
          break
        case 'lower':
          newH = h - params.strength * f * dt
          break
        case 'flatten': {
          const target = params.flattenTarget ?? 0
          newH = h + (target - h) * params.strength * f * dt
          break
        }
        case 'smooth': {
          let sum = 0
          let count = 0
          for (let nz = gz - 1; nz <= gz + 1; nz++) {
            for (let nx = gx - 1; nx <= gx + 1; nx++) {
              if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
                sum += heightmap[nz * resolution + nx]
                count++
              }
            }
          }
          const avg = sum / count
          newH = h + (avg - h) * params.strength * f * dt
          break
        }
      }

      if (newH !== h) {
        changes.set(index, newH)
      }
    }
  }

  return changes
}
