import { NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { createCanvas } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'

const MODEL_PATH = path.resolve('public/models/f1_2026.glb')
const SIZE = 4096

const PARTS: {
  name: string
  color: [number, number, number]
  test: (x: number, y: number, z: number) => boolean
}[] = [
  {
    name: 'Front Wing',
    color: [255, 68, 68],
    test: (x, y, z) => x > 0.45 && y < 0.3 && Math.abs(z) > 0.25,
  },
  {
    name: 'Nose Cone',
    color: [255, 136, 0],
    test: (x, y, z) => x > 0.2 && y > 0.25 && y < 0.8 && Math.abs(z) < 0.45,
  },
  { name: 'Front Section', color: [255, 170, 68], test: (x, y, z) => x > 0.2 && y < 0.25 },
  {
    name: 'Cockpit Surround',
    color: [255, 221, 0],
    test: (x, y, z) => x > -1.2 && x < 0.2 && y > 0.5 && Math.abs(z) < 0.4,
  },
  {
    name: 'Halo Area',
    color: [200, 200, 0],
    test: (x, y, z) => x > -1.5 && x < -0.3 && y > 0.85 && Math.abs(z) < 0.25,
  },
  { name: 'Airbox / Roll Hoop', color: [0, 221, 255], test: (x, y, z) => y > 0.9 },
  {
    name: 'Sidepod (L)',
    color: [0, 255, 68],
    test: (x, y, z) => x > -2.5 && x < 0 && y > 0.35 && y < 0.85 && z > 0.45,
  },
  {
    name: 'Sidepod (R)',
    color: [0, 200, 50],
    test: (x, y, z) => x > -2.5 && x < 0 && y > 0.35 && y < 0.85 && z < -0.45,
  },
  {
    name: 'Shark Fin',
    color: [0, 136, 255],
    test: (x, y, z) => x < -1.2 && x > -3.2 && y > 0.65 && Math.abs(z) < 0.15,
  },
  {
    name: 'Engine Cover',
    color: [0, 255, 170],
    test: (x, y, z) => x < -0.5 && x > -3.5 && y > 0.45 && y < 0.85 && Math.abs(z) < 0.5,
  },
  { name: 'Rear Wing', color: [68, 0, 255], test: (x, y, z) => x < -3.5 && y > 0.2 },
  {
    name: 'Rear Light',
    color: [255, 0, 68],
    test: (x, y, z) => x > 0.65 && x < 0.78 && y > 0.25 && y < 0.7,
  },
  { name: 'Diffuser', color: [170, 0, 255], test: (x, y, z) => x < -3.0 && y < 0.25 },
  { name: 'Floor / Underbody', color: [255, 0, 170], test: (x, y, z) => y < 0.08 },
  { name: 'Side Panel (L)', color: [255, 102, 68], test: (x, y, z) => z > 0.4 && y < 0.5 },
  { name: 'Side Panel (R)', color: [220, 80, 50], test: (x, y, z) => z < -0.4 && y < 0.5 },
  { name: 'Upper Body', color: [136, 255, 68], test: () => true },
]

function classifyVertex(
  x: number,
  y: number,
  z: number,
): { name: string; color: [number, number, number] } {
  for (const part of PARTS) {
    if (part.test(x, y, z)) return { name: part.name, color: part.color }
  }
  return PARTS[PARTS.length - 1]
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  color: [number, number, number],
) {
  const px0 = u0 * SIZE,
    py0 = (1 - v0) * SIZE
  const px1 = u1 * SIZE,
    py1 = (1 - v1) * SIZE
  const px2 = u2 * SIZE,
    py2 = (1 - v2) * SIZE

  ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5)`
  ctx.beginPath()
  ctx.moveTo(px0, py0)
  ctx.lineTo(px1, py1)
  ctx.lineTo(px2, py2)
  ctx.closePath()
  ctx.fill()
}

async function main() {
  console.log('Loading GLB...')
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })

  const doc = await io.read(MODEL_PATH)
  const root = doc.getRoot()

  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, SIZE, SIZE)

  let totalTriangles = 0

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial()
      if (!mat?.getName()?.startsWith('Livery')) continue

      const posAccessor = prim.getAttribute('POSITION')
      const uvAccessor = prim.getAttribute('TEXCOORD_0')
      const indexAccessor = prim.getIndices()
      if (!posAccessor || !uvAccessor) continue

      const positions = posAccessor.getArray()!
      const uvs = uvAccessor.getArray()!
      const indices = indexAccessor?.getArray()
      const vertCount = posAccessor.getCount()
      const triCount = indices ? indices.length / 3 : vertCount / 3

      for (let t = 0; t < triCount; t++) {
        const i0 = indices ? indices[t * 3] : t * 3
        const i1 = indices ? indices[t * 3 + 1] : t * 3 + 1
        const i2 = indices ? indices[t * 3 + 2] : t * 3 + 2

        const cx = (positions[i0 * 3] + positions[i1 * 3] + positions[i2 * 3]) / 3
        const cy = (positions[i0 * 3 + 1] + positions[i1 * 3 + 1] + positions[i2 * 3 + 1]) / 3
        const cz = (positions[i0 * 3 + 2] + positions[i1 * 3 + 2] + positions[i2 * 3 + 2]) / 3

        const { color } = classifyVertex(cx, cy, cz)

        drawTriangle(
          ctx,
          uvs[i0 * 2],
          uvs[i0 * 2 + 1],
          uvs[i1 * 2],
          uvs[i1 * 2 + 1],
          uvs[i2 * 2],
          uvs[i2 * 2 + 1],
          color,
        )
        totalTriangles++
      }
    }
  }

  console.log(`Rendered ${totalTriangles} triangles`)

  // Draw UV wireframe on top
  ctx.globalAlpha = 0.3
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 0.5

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial()
      if (!mat?.getName()?.startsWith('Livery')) continue

      const uvAccessor = prim.getAttribute('TEXCOORD_0')
      const indexAccessor = prim.getIndices()
      if (!uvAccessor) continue

      const uvs = uvAccessor.getArray()!
      const indices = indexAccessor?.getArray()
      const vertCount = uvAccessor.getCount()
      const triCount = indices ? indices.length / 3 : vertCount / 3

      for (let t = 0; t < triCount; t++) {
        const i0 = indices ? indices[t * 3] : t * 3
        const i1 = indices ? indices[t * 3 + 1] : t * 3 + 1
        const i2 = indices ? indices[t * 3 + 2] : t * 3 + 2

        ctx.beginPath()
        ctx.moveTo(uvs[i0 * 2] * SIZE, (1 - uvs[i0 * 2 + 1]) * SIZE)
        ctx.lineTo(uvs[i1 * 2] * SIZE, (1 - uvs[i1 * 2 + 1]) * SIZE)
        ctx.lineTo(uvs[i2 * 2] * SIZE, (1 - uvs[i2 * 2 + 1]) * SIZE)
        ctx.closePath()
        ctx.stroke()
      }
    }
  }

  const outPath = path.resolve('uv_layout_annotated.png')
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(outPath, buffer)
  console.log(`ID map saved to ${outPath}`)
}

main().catch(console.error)
