import * as THREE from 'three'

export function createMonocoqueProfile(): THREE.Shape {
  const shape = new THREE.Shape()

  shape.moveTo(0, -0.15)
  shape.lineTo(2.0, -0.15)
  shape.quadraticCurveTo(2.3, -0.14, 2.5, -0.10)
  shape.quadraticCurveTo(2.6, -0.06, 2.65, 0.0)
  shape.quadraticCurveTo(2.5, 0.02, 2.2, 0.02)
  shape.lineTo(1.0, 0.06)
  shape.quadraticCurveTo(0.7, 0.15, 0.5, 0.25)
  shape.quadraticCurveTo(0.3, 0.33, 0.0, 0.35)
  shape.quadraticCurveTo(-0.2, 0.35, -0.4, 0.32)
  shape.quadraticCurveTo(-0.6, 0.28, -0.8, 0.20)
  shape.quadraticCurveTo(-1.0, 0.12, -1.3, 0.06)
  shape.quadraticCurveTo(-1.6, 0.0, -1.9, -0.02)
  shape.quadraticCurveTo(-2.1, -0.06, -2.25, -0.10)
  shape.lineTo(-2.3, -0.15)
  shape.lineTo(0, -0.15)

  return shape
}

export function createNoseConeGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = []

  points.push(new THREE.Vector2(0.04, 0))
  points.push(new THREE.Vector2(0.06, 0.06))
  points.push(new THREE.Vector2(0.09, 0.12))
  points.push(new THREE.Vector2(0.13, 0.18))
  points.push(new THREE.Vector2(0.17, 0.24))
  points.push(new THREE.Vector2(0.20, 0.30))
  points.push(new THREE.Vector2(0.23, 0.36))
  points.push(new THREE.Vector2(0.25, 0.42))
  points.push(new THREE.Vector2(0.25, 0.50))

  return new THREE.LatheGeometry(points, 16)
}

export function createSidepodProfile(): THREE.Shape {
  const shape = new THREE.Shape()

  shape.moveTo(0, 0)
  shape.lineTo(0.32, 0)
  shape.quadraticCurveTo(0.36, 0, 0.38, 0.04)
  shape.lineTo(0.38, 0.26)
  shape.quadraticCurveTo(0.38, 0.30, 0.34, 0.32)
  shape.quadraticCurveTo(0.28, 0.34, 0.20, 0.34)
  shape.lineTo(0.10, 0.32)
  shape.quadraticCurveTo(0.04, 0.30, 0.02, 0.26)
  shape.lineTo(0, 0.12)
  shape.lineTo(0, 0)

  return shape
}

export function createFloorGeometry(): THREE.BufferGeometry {
  const zRows = [2.3, 2.03, 1.37, 1.03, 0.5, -0.5, -1.03, -1.3, -1.8, -2.35]
  const xCols = [-0.85, -0.70, -0.35, 0, 0.35, 0.70, 0.85]

  const wheelCutouts = [
    { xMin: 0.55, xMax: 0.86, zMin: 1.30, zMax: 2.10 },
    { xMin: -0.86, xMax: -0.55, zMin: 1.30, zMax: 2.10 },
    { xMin: 0.55, xMax: 0.86, zMin: -2.10, zMax: -1.30 },
    { xMin: -0.86, xMax: -0.55, zMin: -2.10, zMax: -1.30 },
  ]

  function diffuserY(z: number): number {
    if (z >= -1.3) return 0
    const t = (z - -1.3) / (-2.35 - -1.3)
    return 0.40 * t * t
  }

  function diffuserHalfW(z: number): number {
    if (z >= -1.3) return 0.85
    const t = (z - -1.3) / (-2.35 - -1.3)
    return 0.85 - 0.30 * t
  }

  function inCutout(x: number, z: number): boolean {
    for (const c of wheelCutouts) {
      if (x >= c.xMin && x <= c.xMax && z >= c.zMin && z <= c.zMax) return true
    }
    return false
  }

  const positions: number[] = []
  const vertMap = new Map<string, number>()

  function addVert(x: number, z: number): number {
    const hw = diffuserHalfW(z)
    const cx = Math.max(-hw, Math.min(hw, x))
    const y = diffuserY(z)
    const key = `${cx.toFixed(4)}_${z.toFixed(4)}`
    const existing = vertMap.get(key)
    if (existing !== undefined) return existing
    const idx = positions.length / 3
    positions.push(cx, y, z)
    vertMap.set(key, idx)
    return idx
  }

  const indices: number[] = []

  for (let iz = 0; iz < zRows.length - 1; iz++) {
    const z0 = zRows[iz]
    const z1 = zRows[iz + 1]
    const zmid = (z0 + z1) / 2

    for (let ix = 0; ix < xCols.length - 1; ix++) {
      const x0 = xCols[ix]
      const x1 = xCols[ix + 1]
      const xmid = (x0 + x1) / 2

      if (inCutout(xmid, zmid)) continue

      const a = addVert(x0, z0)
      const b = addVert(x1, z0)
      const c = addVert(x1, z1)
      const d = addVert(x0, z1)
      indices.push(a, b, c)
      indices.push(a, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

export interface MonocoqueSection {
  z: number
  halfW: number
  wallH: number
}

export const MONOCOQUE_SECTIONS: MonocoqueSection[] = [
  { z: 2.2,  halfW: 0.15, wallH: 0.08 },
  { z: 1.4,  halfW: 0.28, wallH: 0.15 },
  { z: 0.5,  halfW: 0.35, wallH: 0.28 },
  { z: -0.3, halfW: 0.30, wallH: 0.22 },
  { z: -1.3, halfW: 0.25, wallH: 0.15 },
]

export const MONOCOQUE_BASE_Y = -0.15

export function createMonocoqueTubLines(): THREE.BufferGeometry {
  const sections = MONOCOQUE_SECTIONS
  const baseY = MONOCOQUE_BASE_Y
  const positions: number[] = []

  function sectionPoints(s: MonocoqueSection): THREE.Vector3[] {
    const top = baseY + s.wallH
    return [
      new THREE.Vector3(-s.halfW, top, s.z),
      new THREE.Vector3(-s.halfW, baseY, s.z),
      new THREE.Vector3(s.halfW, baseY, s.z),
      new THREE.Vector3(s.halfW, top, s.z),
    ]
  }

  for (const s of sections) {
    const pts = sectionPoints(s)
    for (let j = 0; j < pts.length - 1; j++) {
      positions.push(pts[j].x, pts[j].y, pts[j].z)
      positions.push(pts[j + 1].x, pts[j + 1].y, pts[j + 1].z)
    }
  }

  for (let i = 0; i < sections.length - 1; i++) {
    const a = sectionPoints(sections[i])
    const b = sectionPoints(sections[i + 1])
    for (let j = 0; j < a.length; j++) {
      positions.push(a[j].x, a[j].y, a[j].z)
      positions.push(b[j].x, b[j].y, b[j].z)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

export function createMonocoqueTubTubes(radius = 0.012, radialSegs = 5): THREE.BufferGeometry[] {
  const sections = MONOCOQUE_SECTIONS
  const baseY = MONOCOQUE_BASE_Y

  function sectionPoints(s: MonocoqueSection): THREE.Vector3[] {
    const top = baseY + s.wallH
    return [
      new THREE.Vector3(-s.halfW, top, s.z),
      new THREE.Vector3(-s.halfW, baseY, s.z),
      new THREE.Vector3(s.halfW, baseY, s.z),
      new THREE.Vector3(s.halfW, top, s.z),
    ]
  }

  const geometries: THREE.BufferGeometry[] = []

  for (const s of sections) {
    const pts = sectionPoints(s)
    const curve = new THREE.CatmullRomCurve3(pts, false)
    geometries.push(new THREE.TubeGeometry(curve, 12, radius, radialSegs, false))
  }

  for (let j = 0; j < 4; j++) {
    const railPts: THREE.Vector3[] = []
    for (const s of sections) {
      const pts = sectionPoints(s)
      railPts.push(pts[j])
    }
    const curve = new THREE.CatmullRomCurve3(railPts, false)
    geometries.push(new THREE.TubeGeometry(curve, 24, radius, radialSegs, false))
  }

  return geometries
}

export function createHaloCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.24, 0.28, 0.50),
    new THREE.Vector3(-0.22, 0.36, 0.58),
    new THREE.Vector3(-0.16, 0.44, 0.68),
    new THREE.Vector3(-0.08, 0.50, 0.76),
    new THREE.Vector3(0.0,   0.52, 0.80),
    new THREE.Vector3(0.08,  0.50, 0.76),
    new THREE.Vector3(0.16,  0.44, 0.68),
    new THREE.Vector3(0.22,  0.36, 0.58),
    new THREE.Vector3(0.24,  0.28, 0.50),
  ])
}

export function createHaloCenterStrut(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.18, 0.32),
    new THREE.Vector3(0, 0.28, 0.45),
    new THREE.Vector3(0, 0.40, 0.60),
    new THREE.Vector3(0, 0.50, 0.74),
    new THREE.Vector3(0, 0.52, 0.80),
  ])
}

export function createSpoonWingGeometry(
  width: number,
  depth: number,
  segments: number = 24,
): THREE.BufferGeometry {
  const halfW = width / 2
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const depthSegs = 6

  for (let ix = 0; ix <= segments; ix++) {
    const u = ix / segments
    const x = (u - 0.5) * width
    const spoon = 1.0 - Math.pow(Math.abs(x) / halfW, 2.2)
    const yDrop = -0.05 * spoon

    for (let iz = 0; iz <= depthSegs; iz++) {
      const v = iz / depthSegs
      const z = (v - 0.5) * depth
      const camber = -0.012 * Math.sin(v * Math.PI)
      const tipDroop = Math.abs(x) > halfW * 0.85 ? -0.008 * ((Math.abs(x) - halfW * 0.85) / (halfW * 0.15)) : 0

      positions.push(x, yDrop + camber + tipDroop, z)
      normals.push(0, 1, 0)
    }
  }

  const stride = depthSegs + 1
  for (let ix = 0; ix < segments; ix++) {
    for (let iz = 0; iz < depthSegs; iz++) {
      const a = ix * stride + iz
      const b = a + stride
      indices.push(a, b, a + 1)
      indices.push(a + 1, b, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  return geometry
}

export function createBargeboardGeometry(
  height: number,
  length: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(length, 0)
  shape.quadraticCurveTo(length * 0.9, height * 0.6, length * 0.75, height)
  shape.quadraticCurveTo(length * 0.4, height * 0.9, 0, height * 0.7)
  shape.lineTo(0, 0)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.005,
    bevelEnabled: false,
  }

  return new THREE.ExtrudeGeometry(shape, extrudeSettings)
}

export function createEngineCoverProfile(): THREE.Shape {
  const shape = new THREE.Shape()

  shape.moveTo(-0.8, 0)
  shape.quadraticCurveTo(-0.6, 0.14, -0.2, 0.16)
  shape.quadraticCurveTo(0.0, 0.17, 0.2, 0.16)
  shape.quadraticCurveTo(0.6, 0.14, 0.8, 0)
  shape.lineTo(-0.8, 0)

  return shape
}

function interpMonocoqueSection(z: number): { halfW: number; wallH: number } {
  const sections = MONOCOQUE_SECTIONS
  if (z >= sections[0].z) return { halfW: sections[0].halfW, wallH: sections[0].wallH }
  if (z <= sections[sections.length - 1].z) {
    const last = sections[sections.length - 1]
    return { halfW: last.halfW, wallH: last.wallH }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    if (z <= sections[i].z && z >= sections[i + 1].z) {
      const t = (sections[i].z - z) / (sections[i].z - sections[i + 1].z)
      const smooth = t * t * (3 - 2 * t)
      return {
        halfW: sections[i].halfW + (sections[i + 1].halfW - sections[i].halfW) * smooth,
        wallH: sections[i].wallH + (sections[i + 1].wallH - sections[i].wallH) * smooth,
      }
    }
  }
  return { halfW: 0.25, wallH: 0.15 }
}

export function createSurvivalCellSurface(): THREE.BufferGeometry {
  const baseY = MONOCOQUE_BASE_Y
  const zSegs = 48
  const xSegs = 24

  const positions: number[] = []
  const indices: number[] = []

  const cockpitZMin = 0.10
  const cockpitZMax = 0.90
  const cockpitPeakZ = 0.50

  const cellZMin = -0.3
  const zMax = MONOCOQUE_SECTIONS[0].z

  for (let iz = 0; iz <= zSegs; iz++) {
    const z = zMax - (iz / zSegs) * (zMax - cellZMin)
    const sec = interpMonocoqueSection(z)

    for (let ix = 0; ix <= xSegs; ix++) {
      const u = ix / xSegs
      const x = (u - 0.5) * 2 * sec.halfW
      const xNorm = Math.abs(x) / Math.max(sec.halfW, 0.01)

      const topY = baseY + sec.wallH
      const crown = 0.04 * (1 - xNorm * xNorm)
      let y = topY + crown

      if (z >= cockpitZMin && z <= cockpitZMax) {
        const cockpitHalfW = sec.halfW * 0.65
        const wallRimW = sec.halfW * 0.06

        const zFromPeak = Math.abs(z - cockpitPeakZ)
        const zHalfRange = (cockpitZMax - cockpitZMin) / 2
        const zNorm = zFromPeak / zHalfRange
        const zEdge = Math.min((z - cockpitZMin) / 0.06, (cockpitZMax - z) / 0.06, 1)
        const zFactor = (1 - zNorm * zNorm) * Math.min(zEdge, 1)

        if (Math.abs(x) < cockpitHalfW) {
          const depth = sec.wallH * 0.85 * zFactor
          y = topY + crown - depth
        } else if (Math.abs(x) < cockpitHalfW + wallRimW) {
          const rimT = (Math.abs(x) - cockpitHalfW) / wallRimW
          const rimSharp = Math.pow(rimT, 0.3)
          const depth = sec.wallH * 0.85 * zFactor * (1 - rimSharp)
          y = topY + crown - depth
        }
      }

      positions.push(x, y, z)
    }
  }

  const stride = xSegs + 1
  for (let iz = 0; iz < zSegs; iz++) {
    for (let ix = 0; ix < xSegs; ix++) {
      const a = iz * stride + ix
      const b = a + stride
      indices.push(a, b, a + 1)
      indices.push(a + 1, b, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createSurvivalCellSides(): THREE.BufferGeometry {
  const baseY = MONOCOQUE_BASE_Y
  const zSegs = 48

  const positions: number[] = []
  const indices: number[] = []

  const zMin = -0.3
  const zMax = MONOCOQUE_SECTIONS[0].z

  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1
    const offset = side * (zSegs + 1) * 2

    for (let iz = 0; iz <= zSegs; iz++) {
      const z = zMax - (iz / zSegs) * (zMax - zMin)
      const sec = interpMonocoqueSection(z)
      const x = sign * sec.halfW
      const topY = baseY + sec.wallH + 0.04

      positions.push(x, baseY, z)
      positions.push(x, topY, z)
    }

    for (let iz = 0; iz < zSegs; iz++) {
      const a = offset + iz * 2
      const b = offset + (iz + 1) * 2
      if (sign < 0) {
        indices.push(a, a + 1, b)
        indices.push(b, a + 1, b + 1)
      } else {
        indices.push(a, b, a + 1)
        indices.push(a + 1, b, b + 1)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createNoseBodyGeometry(): THREE.BufferGeometry {
  const baseY = MONOCOQUE_BASE_Y
  const frontSection = MONOCOQUE_SECTIONS[0]

  const noseStart = frontSection.z
  const noseTip = noseStart + 0.60
  const zSegs = 24
  const circumSegs = 16

  const positions: number[] = []
  const indices: number[] = []

  const startTopY = baseY + frontSection.wallH
  const startCenterY = (baseY + startTopY) / 2
  const tipCenterY = baseY - 0.02

  const tipRadiusX = 0.08
  const tipRadiusY = 0.06

  for (let iz = 0; iz <= zSegs; iz++) {
    const t = iz / zSegs
    const z = noseStart + t * (noseTip - noseStart)

    const taperSmooth = t * t * (3 - 2 * t)
    const halfW = frontSection.halfW + (tipRadiusX - frontSection.halfW) * taperSmooth
    const halfH = (frontSection.wallH / 2) + (tipRadiusY - frontSection.wallH / 2) * taperSmooth

    const droopT = t * t
    const centerY = startCenterY + (tipCenterY - startCenterY) * droopT

    for (let ic = 0; ic <= circumSegs; ic++) {
      const angle = (ic / circumSegs) * Math.PI * 2
      let x = Math.cos(angle) * halfW
      let y = centerY + Math.sin(angle) * halfH

      if (t > 0.7) {
        const capT = (t - 0.7) / 0.3
        const sphereBlend = capT * capT * (3 - 2 * capT)
        const currentRadius = Math.sqrt(halfW * halfW + halfH * halfH)
        const sphereRadius = Math.max(tipRadiusX, tipRadiusY)
        const blendRadius = currentRadius + (sphereRadius - currentRadius) * sphereBlend

        if (currentRadius > 0.001) {
          const normalizedX = x / currentRadius
          const normalizedY = (y - centerY) / currentRadius
          x = normalizedX * blendRadius
          y = centerY + normalizedY * blendRadius
        }
      }

      positions.push(x, y, z)
    }
  }

  const stride = circumSegs + 1
  for (let iz = 0; iz < zSegs; iz++) {
    for (let ic = 0; ic < circumSegs; ic++) {
      const a = iz * stride + ic
      const b = a + stride
      indices.push(a, b, a + 1)
      indices.push(a + 1, b, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createNoseTipCapGeometry(): THREE.BufferGeometry {
  const baseY = MONOCOQUE_BASE_Y
  const frontSection = MONOCOQUE_SECTIONS[0]

  const noseStart = frontSection.z
  const noseTip = noseStart + 0.60
  const capStart = noseTip - 0.18

  const tipCenterY = baseY - 0.02
  const tipRadiusX = 0.08
  const tipRadiusY = 0.06
  const sphereRadius = Math.max(tipRadiusX, tipRadiusY)

  const positions: number[] = []
  const indices: number[] = []

  const latSegs = 12
  const lonSegs = 16

  for (let ilat = 0; ilat <= latSegs; ilat++) {
    const theta = (ilat / latSegs) * (Math.PI / 2)
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    const z = noseTip - sphereRadius * cosTheta
    if (z < capStart) continue

    for (let ilon = 0; ilon <= lonSegs; ilon++) {
      const phi = (ilon / lonSegs) * Math.PI * 2
      const x = sphereRadius * sinTheta * Math.cos(phi) * (tipRadiusX / sphereRadius)
      const y = tipCenterY + sphereRadius * sinTheta * Math.sin(phi) * (tipRadiusY / sphereRadius)

      positions.push(x, y, z)
    }
  }

  const stride = lonSegs + 1
  const numRows = Math.floor(positions.length / 3 / stride)
  for (let ilat = 0; ilat < numRows - 1; ilat++) {
    for (let ilon = 0; ilon < lonSegs; ilon++) {
      const a = ilat * stride + ilon
      const b = a + stride
      indices.push(a, b, a + 1)
      indices.push(a + 1, b, b + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createSurvivalCellBottom(): THREE.BufferGeometry {
  const baseY = MONOCOQUE_BASE_Y
  const zSegs = 32
  const xSegs = 8

  const positions: number[] = []
  const indices: number[] = []

  const zMin = -0.3
  const zMax = MONOCOQUE_SECTIONS[0].z

  for (let iz = 0; iz <= zSegs; iz++) {
    const z = zMax - (iz / zSegs) * (zMax - zMin)
    const hw = interpMonocoqueSection(z).halfW

    for (let ix = 0; ix <= xSegs; ix++) {
      const u = ix / xSegs
      const x = (u - 0.5) * 2 * hw
      positions.push(x, baseY, z)
    }
  }

  const stride = xSegs + 1
  for (let iz = 0; iz < zSegs; iz++) {
    for (let ix = 0; ix < xSegs; ix++) {
      const a = iz * stride + ix
      const b = a + stride
      indices.push(a, a + 1, b)
      indices.push(a + 1, b + 1, b)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createAirboxGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()

  shape.moveTo(-0.08, 0)
  shape.quadraticCurveTo(-0.09, 0.08, -0.08, 0.14)
  shape.quadraticCurveTo(-0.06, 0.18, 0, 0.19)
  shape.quadraticCurveTo(0.06, 0.18, 0.08, 0.14)
  shape.quadraticCurveTo(0.09, 0.08, 0.08, 0)
  shape.lineTo(-0.08, 0)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
  }

  return new THREE.ExtrudeGeometry(shape, extrudeSettings)
}
