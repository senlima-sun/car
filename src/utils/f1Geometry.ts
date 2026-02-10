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
  const vertices = new Float32Array([
    -0.85, 0, 2.3,
     0.85, 0, 2.3,
     0.85, 0, -1.3,
    -0.85, 0, -1.3,

    -0.85, 0, -1.3,
     0.85, 0, -1.3,
     0.70, 0.40, -2.35,
    -0.70, 0.40, -2.35,
  ])

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
    4, 5, 6,
    4, 6, 7,
  ])

  const diffAngle = Math.atan2(0.40, 1.05)
  const ny = Math.cos(diffAngle)
  const nz = Math.sin(diffAngle)

  const normals = new Float32Array([
    0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
    0, -ny, nz,  0, -ny, nz,  0, -ny, nz,  0, -ny, nz,
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  return geometry
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
