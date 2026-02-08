import type { EditorPart, GeometryType } from '../types'

const DENSITY_TABLE: Record<string, number> = {
  carbon_fiber: 1600,
  aluminum: 2700,
  steel: 7800,
  titanium: 4500,
  plastic: 1200,
  rubber: 1100,
  glass: 2500,
  default: 1600,
}

export function computeVolume(part: EditorPart): number {
  const [sx, sy, sz] = part.scale
  const args = part.args
  const volumeByType: Record<GeometryType, () => number> = {
    box: () => (args[0] ?? 1) * (args[1] ?? 1) * (args[2] ?? 1) * sx * sy * sz,
    cylinder: () => {
      const rTop = (args[0] ?? 0.5) * Math.max(sx, sz)
      const rBot = (args[1] ?? 0.5) * Math.max(sx, sz)
      const h = (args[2] ?? 1) * sy
      return Math.PI * h * (rTop * rTop + rBot * rBot + rTop * rBot) / 3
    },
    sphere: () => {
      const r = (args[0] ?? 0.5) * Math.max(sx, sy, sz)
      return (4 / 3) * Math.PI * r * r * r
    },
    cone: () => {
      const r = (args[0] ?? 0.5) * Math.max(sx, sz)
      const h = (args[1] ?? 1) * sy
      return Math.PI * r * r * h / 3
    },
    capsule: () => {
      const r = (args[0] ?? 0.25) * Math.max(sx, sz)
      const h = (args[1] ?? 1) * sy
      return Math.PI * r * r * h + (4 / 3) * Math.PI * r * r * r
    },
    torus: () => {
      const R = (args[0] ?? 0.5) * Math.max(sx, sz)
      const r = (args[1] ?? 0.15) * Math.min(sx, sy, sz)
      return 2 * Math.PI * Math.PI * R * r * r
    },
    roundedbox: () => {
      const w = (args[0] ?? 1) * sx
      const h = (args[1] ?? 1) * sy
      const d = (args[2] ?? 1) * sz
      return w * h * d
    },
    extrude: () => {
      const h = (args[0] ?? 0.1) * sy
      const pts = part.points ?? []
      if (pts.length < 3) return 0
      let area = 0
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length
        area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
      }
      return Math.abs(area / 2) * h * sx * sz
    },
  }
  return volumeByType[part.geometryType]()
}

export function computeMass(part: EditorPart): number {
  if (part.mass !== undefined) return part.mass
  const density = part.density ?? DENSITY_TABLE.default
  return computeVolume(part) * density
}

export interface CenterOfGravity {
  x: number
  y: number
  z: number
  totalMass: number
}

export function computeCG(parts: EditorPart[]): CenterOfGravity {
  let totalMass = 0
  let cx = 0, cy = 0, cz = 0

  for (const part of parts) {
    const m = computeMass(part)
    totalMass += m
    cx += part.position[0] * m
    cy += part.position[1] * m
    cz += part.position[2] * m
  }

  if (totalMass === 0) return { x: 0, y: 0, z: 0, totalMass: 0 }
  return {
    x: cx / totalMass,
    y: cy / totalMass,
    z: cz / totalMass,
    totalMass,
  }
}

export function computeFrontalArea(parts: EditorPart[]): number {
  let area = 0
  for (const part of parts) {
    const [sx, sy] = [part.scale[0], part.scale[1]]
    const args = part.args
    switch (part.geometryType) {
      case 'box':
      case 'roundedbox':
        area += (args[0] ?? 1) * sx * (args[1] ?? 1) * sy
        break
      case 'cylinder':
        area += (args[0] ?? 0.5) * 2 * Math.max(sx, part.scale[2]) * (args[2] ?? 1) * sy
        break
      case 'sphere':
        area += Math.PI * ((args[0] ?? 0.5) * Math.max(sx, sy)) ** 2
        break
      case 'cone':
        area += (args[0] ?? 0.5) * sx * (args[1] ?? 1) * sy
        break
      default:
        area += 0.1
    }
  }
  return area
}

export function estimateDragCoefficient(parts: EditorPart[]): number {
  if (parts.length === 0) return 0

  const cdByType: Partial<Record<GeometryType, number>> = {
    box: 1.05,
    roundedbox: 0.8,
    cylinder: 0.82,
    sphere: 0.47,
    cone: 0.5,
    capsule: 0.38,
  }

  let totalArea = 0
  let weightedCd = 0

  for (const part of parts) {
    const a = computeFrontalArea([part])
    const cd = cdByType[part.geometryType] ?? 0.7
    weightedCd += cd * a
    totalArea += a
  }

  return totalArea > 0 ? weightedCd / totalArea : 0.35
}

export interface PhysicsWarning {
  level: 'info' | 'warn' | 'error'
  message: string
}

export function validatePhysics(parts: EditorPart[]): PhysicsWarning[] {
  const warnings: PhysicsWarning[] = []
  if (parts.length === 0) return warnings

  const cg = computeCG(parts)

  if (cg.totalMass > 50) {
    warnings.push({ level: 'error', message: `Total mass ${cg.totalMass.toFixed(1)}kg exceeds 50kg limit` })
  } else if (cg.totalMass > 35) {
    warnings.push({ level: 'warn', message: `Total mass ${cg.totalMass.toFixed(1)}kg is high` })
  }

  if (parts.length > 0) {
    let minZ = Infinity, maxZ = -Infinity
    for (const p of parts) {
      minZ = Math.min(minZ, p.position[2])
      maxZ = Math.max(maxZ, p.position[2])
    }
    const length = maxZ - minZ
    if (length > 0.01) {
      const cgRatio = (cg.z - minZ) / length
      if (cgRatio < 0.35 || cgRatio > 0.65) {
        warnings.push({
          level: 'warn',
          message: `CG weight distribution ${(cgRatio * 100).toFixed(0)}/${((1 - cgRatio) * 100).toFixed(0)} is outside 40/60 range`,
        })
      }
    }
  }

  if (cg.y > 0.5) {
    warnings.push({ level: 'warn', message: `CG height ${cg.y.toFixed(2)}m may cause rollover` })
  }

  const cgOffsetX = Math.abs(cg.x)
  if (cgOffsetX > 0.1) {
    warnings.push({ level: 'info', message: `CG lateral offset ${cgOffsetX.toFixed(2)}m — car will pull to one side` })
  }

  return warnings
}
