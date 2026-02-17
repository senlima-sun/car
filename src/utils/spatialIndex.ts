import type { SnapPointWithDirection } from '../types/trackObjects'

const DEFAULT_CELL_SIZE = 4

export class SpatialIndex {
  private cells: Map<string, SnapPointWithDirection[]>
  private cellSize: number

  constructor(cellSize: number = DEFAULT_CELL_SIZE) {
    this.cells = new Map()
    this.cellSize = cellSize
  }

  private getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    return `${cx},${cz}`
  }

  clear(): void {
    this.cells.clear()
  }

  insert(point: SnapPointWithDirection): void {
    const key = this.getCellKey(point.position[0], point.position[2])
    if (!this.cells.has(key)) {
      this.cells.set(key, [])
    }
    this.cells.get(key)!.push(point)
  }

  buildFromPoints(points: SnapPointWithDirection[]): void {
    this.clear()
    for (const point of points) {
      this.insert(point)
    }
  }

  findNearest(pos: [number, number, number], threshold: number = 2): SnapPointWithDirection | null {
    const cx = Math.floor(pos[0] / this.cellSize)
    const cz = Math.floor(pos[2] / this.cellSize)
    const searchRadius = Math.ceil(threshold / this.cellSize)

    let nearest: SnapPointWithDirection | null = null
    let minDist = threshold

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dz = -searchRadius; dz <= searchRadius; dz++) {
        const key = `${cx + dx},${cz + dz}`
        const cell = this.cells.get(key)
        if (!cell) continue

        for (const point of cell) {
          const distX = pos[0] - point.position[0]
          const distZ = pos[2] - point.position[2]
          const dist = Math.sqrt(distX * distX + distZ * distZ)
          if (dist < minDist) {
            minDist = dist
            nearest = point
          }
        }
      }
    }

    return nearest
  }

  get size(): number {
    let count = 0
    for (const cell of this.cells.values()) {
      count += cell.length
    }
    return count
  }
}
