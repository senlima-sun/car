import * as THREE from 'three'

export function createMonocoqueProfile(): THREE.Shape {
  const shape = new THREE.Shape()

  shape.moveTo(0, -0.15)
  shape.lineTo(2.2, -0.15)
  shape.quadraticCurveTo(2.5, -0.12, 2.6, -0.05)
  shape.lineTo(2.65, 0.0)
  shape.quadraticCurveTo(2.5, 0.02, 2.2, 0.02)
  shape.lineTo(0.8, 0.1)
  shape.quadraticCurveTo(0.5, 0.25, 0.3, 0.32)
  shape.lineTo(0.0, 0.35)
  shape.quadraticCurveTo(-0.3, 0.35, -0.5, 0.30)
  shape.lineTo(-0.8, 0.18)
  shape.quadraticCurveTo(-1.2, 0.08, -1.5, 0.02)
  shape.lineTo(-2.0, -0.02)
  shape.quadraticCurveTo(-2.2, -0.06, -2.3, -0.1)
  shape.lineTo(-2.3, -0.15)
  shape.lineTo(0, -0.15)

  return shape
}

export function createNoseConeGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = []

  points.push(new THREE.Vector2(0.05, 0))
  points.push(new THREE.Vector2(0.08, 0.08))
  points.push(new THREE.Vector2(0.12, 0.15))
  points.push(new THREE.Vector2(0.18, 0.22))
  points.push(new THREE.Vector2(0.22, 0.28))
  points.push(new THREE.Vector2(0.25, 0.35))
  points.push(new THREE.Vector2(0.25, 0.5))

  return new THREE.LatheGeometry(points, 16)
}

export function createSidepodProfile(): THREE.Shape {
  const shape = new THREE.Shape()

  shape.moveTo(0, 0)
  shape.lineTo(0.35, 0)
  shape.quadraticCurveTo(0.38, 0, 0.38, 0.05)
  shape.lineTo(0.38, 0.28)
  shape.quadraticCurveTo(0.38, 0.32, 0.35, 0.32)
  shape.lineTo(0.12, 0.32)
  shape.quadraticCurveTo(0.05, 0.32, 0.02, 0.28)
  shape.lineTo(0, 0.15)
  shape.lineTo(0, 0)

  return shape
}

export function createFloorGeometry(): THREE.BufferGeometry {
  const vertices = new Float32Array([
    -0.85, 0, 2.2,
     0.85, 0, 2.2,
     0.85, 0, -1.4,
    -0.85, 0, -1.4,

    -0.85, 0, -1.4,
     0.85, 0, -1.4,
     0.7,  0.35, -2.3,
    -0.7,  0.35, -2.3,
  ])

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
    4, 5, 6,
    4, 6, 7,
  ])

  const normals = new Float32Array([
    0, -1, 0,  0, -1, 0,  0, -1, 0,  0, -1, 0,
    0, -0.97, 0.26,  0, -0.97, 0.26,  0, -0.97, 0.26,  0, -0.97, 0.26,
  ])

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  return geometry
}

export function createHaloCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 0.30, 0.55),
    new THREE.Vector3(-0.18, 0.42, 0.65),
    new THREE.Vector3(-0.08, 0.50, 0.75),
    new THREE.Vector3(0.0,   0.52, 0.80),
    new THREE.Vector3(0.08,  0.50, 0.75),
    new THREE.Vector3(0.18,  0.42, 0.65),
    new THREE.Vector3(0.22,  0.30, 0.55),
  ])
}

export function createHaloCenterStrut(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.20, 0.35),
    new THREE.Vector3(0, 0.38, 0.55),
    new THREE.Vector3(0, 0.50, 0.72),
    new THREE.Vector3(0, 0.52, 0.80),
  ])
}

export function createSpoonWingGeometry(
  width: number,
  depth: number,
  segments: number = 24,
): THREE.BufferGeometry {
  const halfW = width / 2
  const halfD = depth / 2
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  for (let ix = 0; ix <= segments; ix++) {
    const u = ix / segments
    const x = (u - 0.5) * width
    const spoon = 1.0 - Math.pow(Math.abs(x) / halfW, 2)
    const yDrop = -0.04 * spoon

    for (let iz = 0; iz <= 4; iz++) {
      const v = iz / 4
      const z = (v - 0.5) * depth
      const camber = -0.008 * Math.sin(v * Math.PI)

      positions.push(x, yDrop + camber, z)
      normals.push(0, 1, 0)
    }
  }

  for (let ix = 0; ix < segments; ix++) {
    for (let iz = 0; iz < 4; iz++) {
      const a = ix * 5 + iz
      const b = a + 5
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
  shape.lineTo(length * 0.8, height)
  shape.lineTo(0, height * 0.7)
  shape.lineTo(0, 0)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.005,
    bevelEnabled: false,
  }

  return new THREE.ExtrudeGeometry(shape, extrudeSettings)
}
