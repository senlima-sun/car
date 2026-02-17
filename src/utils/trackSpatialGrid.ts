import type { PlacedObject, ObjectType } from '../types/trackObjects'
import { isCurveMode } from '../types/trackObjects'

const CELL_SIZE = 50

export interface GridEntry {
  objectId: string
  type: ObjectType
}

function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`
}

function worldToCell(v: number): number {
  return Math.floor(v / CELL_SIZE)
}

function rasterizeLine(x0: number, z0: number, x1: number, z1: number): string[] {
  const cx0 = worldToCell(x0)
  const cz0 = worldToCell(z0)
  const cx1 = worldToCell(x1)
  const cz1 = worldToCell(z1)

  const keys = new Set<string>()
  keys.add(cellKey(cx0, cz0))
  keys.add(cellKey(cx1, cz1))

  const steps = Math.max(Math.abs(cx1 - cx0), Math.abs(cz1 - cz0)) + 1
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    keys.add(cellKey(worldToCell(x), worldToCell(z)))
  }

  return Array.from(keys)
}

function sampleBezier(
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
  samples: number,
): string[] {
  const keys = new Set<string>()
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const it = 1 - t
    const x = it * it * start[0] + 2 * it * t * control[0] + t * t * end[0]
    const z = it * it * start[2] + 2 * it * t * control[2] + t * t * end[2]
    keys.add(cellKey(worldToCell(x), worldToCell(z)))
  }
  return Array.from(keys)
}

function aabbCells(points: Array<[number, number, number]>): string[] {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    if (p[0] < minX) minX = p[0]
    if (p[0] > maxX) maxX = p[0]
    if (p[2] < minZ) minZ = p[2]
    if (p[2] > maxZ) maxZ = p[2]
  }
  const keys: string[] = []
  const cxMin = worldToCell(minX)
  const cxMax = worldToCell(maxX)
  const czMin = worldToCell(minZ)
  const czMax = worldToCell(maxZ)
  for (let cx = cxMin; cx <= cxMax; cx++) {
    for (let cz = czMin; cz <= czMax; cz++) {
      keys.push(cellKey(cx, cz))
    }
  }
  return keys
}

export class TrackSpatialGrid {
  private cells: Map<string, GridEntry[]> = new Map()
  private reverseIndex: Map<string, string[]> = new Map()
  private childMap: Map<string, string[]> = new Map()
  private positions: Map<string, { x: number; z: number }> = new Map()

  rebuild(objects: PlacedObject[]): void {
    this.cells.clear()
    this.reverseIndex.clear()
    this.childMap.clear()
    this.positions.clear()

    const roadCellCache = new Map<string, string[]>()

    for (const obj of objects) {
      if (obj.type === 'road' || obj.type === 'barrier') {
        const keys = this.computeLinearOrCurvedCells(obj)
        roadCellCache.set(obj.id, keys)
      }
    }

    for (const obj of objects) {
      const keys = this.computeCellKeys(obj, roadCellCache)
      const entry: GridEntry = { objectId: obj.id, type: obj.type }

      for (const key of keys) {
        let bucket = this.cells.get(key)
        if (!bucket) {
          bucket = []
          this.cells.set(key, bucket)
        }
        bucket.push(entry)
      }
      this.reverseIndex.set(obj.id, keys)

      if (obj.parentRoadId) {
        let children = this.childMap.get(obj.parentRoadId)
        if (!children) {
          children = []
          this.childMap.set(obj.parentRoadId, children)
        }
        children.push(obj.id)
      }

      this.storePosition(obj)
    }
  }

  getCellEntries(key: string): GridEntry[] {
    return this.cells.get(key) ?? []
  }

  getChildIds(roadId: string): string[] {
    return this.childMap.get(roadId) ?? []
  }

  getObjectPosition(id: string): { x: number; z: number } | undefined {
    return this.positions.get(id)
  }

  get cellCount(): number {
    return this.cells.size
  }

  get objectCount(): number {
    return this.reverseIndex.size
  }

  queryCellsInRadius(cx: number, cz: number, radiusCells: number): string[] {
    const keys: string[] = []
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      for (let dz = -radiusCells; dz <= radiusCells; dz++) {
        keys.push(cellKey(cx + dx, cz + dz))
      }
    }
    return keys
  }

  queryCellsInEllipse(
    viewerX: number,
    viewerZ: number,
    heading: number,
    forwardDist: number,
    behindDist: number,
    lateralDist: number,
  ): string[] {
    const maxRange = Math.max(forwardDist, behindDist, lateralDist)
    const cellRange = Math.ceil(maxRange / CELL_SIZE)
    const vcx = worldToCell(viewerX)
    const vcz = worldToCell(viewerZ)

    const cosH = Math.cos(heading)
    const sinH = Math.sin(heading)

    const keys: string[] = []
    for (let dx = -cellRange; dx <= cellRange; dx++) {
      for (let dz = -cellRange; dz <= cellRange; dz++) {
        const wx = (vcx + dx + 0.5) * CELL_SIZE
        const wz = (vcz + dz + 0.5) * CELL_SIZE
        const relX = wx - viewerX
        const relZ = wz - viewerZ

        const forward = relX * sinH + relZ * cosH
        const lateral = relX * cosH - relZ * sinH

        const fDist = forward >= 0 ? forwardDist : behindDist
        const nf = forward / fDist
        const nl = lateral / lateralDist

        if (nf * nf + nl * nl <= 1) {
          keys.push(cellKey(vcx + dx, vcz + dz))
        }
      }
    }
    return keys
  }

  private computeCellKeys(obj: PlacedObject, roadCellCache: Map<string, string[]>): string[] {
    switch (obj.type) {
      case 'cone':
      case 'ramp':
      case 'pitbox':
        return [cellKey(worldToCell(obj.position[0]), worldToCell(obj.position[2]))]

      case 'checkpoint':
      case 'barrier':
      case 'road':
        return this.computeLinearOrCurvedCells(obj)

      case 'curb':
        if (obj.parentRoadId) {
          const parentKeys = roadCellCache.get(obj.parentRoadId)
          if (parentKeys) return parentKeys
        }
        return [cellKey(worldToCell(obj.position[0]), worldToCell(obj.position[2]))]

      case 'grass_patch':
      case 'gravel_patch':
        if (obj.polygonPoints && obj.polygonPoints.length > 0) {
          return aabbCells(obj.polygonPoints)
        }
        return [cellKey(worldToCell(obj.position[0]), worldToCell(obj.position[2]))]

      default:
        return [cellKey(worldToCell(obj.position[0]), worldToCell(obj.position[2]))]
    }
  }

  private computeLinearOrCurvedCells(obj: PlacedObject): string[] {
    if (!obj.startPoint || !obj.endPoint) {
      return [cellKey(worldToCell(obj.position[0]), worldToCell(obj.position[2]))]
    }

    if (isCurveMode(obj.trackMode) && obj.controlPoint) {
      return sampleBezier(obj.startPoint, obj.controlPoint, obj.endPoint, 10)
    }

    return rasterizeLine(obj.startPoint[0], obj.startPoint[2], obj.endPoint[0], obj.endPoint[2])
  }

  private storePosition(obj: PlacedObject): void {
    if (obj.startPoint && obj.endPoint) {
      this.positions.set(obj.id, {
        x: (obj.startPoint[0] + obj.endPoint[0]) * 0.5,
        z: (obj.startPoint[2] + obj.endPoint[2]) * 0.5,
      })
    } else {
      this.positions.set(obj.id, {
        x: obj.position[0],
        z: obj.position[2],
      })
    }
  }
}

export { CELL_SIZE, worldToCell, cellKey }
