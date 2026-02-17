import { Document, NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import fs from 'fs'
import path from 'path'

const MODEL_PATH = path.resolve('public/models/f1_2026.glb')

async function main() {
  console.log('Loading GLB with gltf-transform...')

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })

  const doc = await io.read(MODEL_PATH)
  const root = doc.getRoot()

  for (const mesh of root.listMeshes()) {
    console.log(`\nMesh: ${mesh.getName()}`)

    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial()
      const matName = mat?.getName() ?? '(none)'
      console.log(`  Material: ${matName}`)

      const posAccessor = prim.getAttribute('POSITION')
      const uvAccessor = prim.getAttribute('TEXCOORD_0')
      const indexAccessor = prim.getIndices()

      if (!posAccessor || !uvAccessor) {
        console.log('  No UV data')
        continue
      }

      const positions = posAccessor.getArray()!
      const uvs = uvAccessor.getArray()!
      const indices = indexAccessor?.getArray()

      const vertCount = posAccessor.getCount()
      console.log(`  Vertices: ${vertCount}, UVs: ${uvAccessor.getCount()}`)

      // Build adjacency from triangles
      const adj = new Map<number, Set<number>>()
      const triCount = indices ? indices.length / 3 : vertCount / 3

      for (let t = 0; t < triCount; t++) {
        const a = indices ? indices[t * 3] : t * 3
        const b = indices ? indices[t * 3 + 1] : t * 3 + 1
        const c = indices ? indices[t * 3 + 2] : t * 3 + 2

        for (const [x, y] of [
          [a, b],
          [b, c],
          [a, c],
        ] as [number, number][]) {
          if (!adj.has(x)) adj.set(x, new Set())
          if (!adj.has(y)) adj.set(y, new Set())
          adj.get(x)!.add(y)
          adj.get(y)!.add(x)
        }
      }

      // Find connected components (UV islands)
      const visited = new Set<number>()
      const clusters: { verts: number[] }[] = []

      for (let i = 0; i < vertCount; i++) {
        if (visited.has(i)) continue
        const cluster: number[] = []
        const stack = [i]
        while (stack.length > 0) {
          const v = stack.pop()!
          if (visited.has(v)) continue
          visited.add(v)
          cluster.push(v)
          const neighbors = adj.get(v)
          if (neighbors) for (const n of neighbors) if (!visited.has(n)) stack.push(n)
        }
        if (cluster.length >= 20) clusters.push({ verts: cluster })
      }

      console.log(`  Found ${clusters.length} UV islands (>=20 verts)`)

      // Label each cluster
      for (const c of clusters) {
        let sumU = 0,
          sumV = 0
        let sumX = 0,
          sumY = 0,
          sumZ = 0
        let minU = Infinity,
          maxU = -Infinity,
          minV = Infinity,
          maxV = -Infinity

        for (const vi of c.verts) {
          const u = uvs[vi * 2]
          const v = uvs[vi * 2 + 1]
          sumU += u
          sumV += v
          minU = Math.min(minU, u)
          maxU = Math.max(maxU, u)
          minV = Math.min(minV, v)
          maxV = Math.max(maxV, v)

          sumX += positions[vi * 3]
          sumY += positions[vi * 3 + 1]
          sumZ += positions[vi * 3 + 2]
        }

        const n = c.verts.length
        const avgU = sumU / n,
          avgV = sumV / n
        const avgX = sumX / n,
          avgY = sumY / n,
          avgZ = sumZ / n

        // GLB coordinate system from Blender: X = left-right, Y = up, Z = front-back
        // But in the exported GLB, the car faces -X with:
        // X: negative = rear, positive = front
        // Y: up
        // Z: left-right

        let label = 'Unknown'

        if (avgY > 0.9) label = 'Airbox / Roll Hoop'
        else if (avgY > 0.6 && Math.abs(avgZ) < 0.3) label = 'Engine Cover Top'
        else if (avgY > 0.5 && Math.abs(avgZ) > 0.5) label = 'Sidepod Top'
        else if (avgX > 0.3 && avgY < 0.3) label = 'Front Wing'
        else if (avgX > 0 && avgY > 0.3 && avgY < 0.7 && Math.abs(avgZ) < 0.5) label = 'Nose Cone'
        else if (avgX < -3.5 && avgY > 0.3) label = 'Rear Wing'
        else if (avgX < -3 && avgY < 0.3) label = 'Diffuser / Rear Floor'
        else if (avgY < 0.1 && maxU - minU > 0.1) label = 'Floor / Underbody'
        else if (avgY > 0.3 && avgY < 0.6 && Math.abs(avgZ) > 0.3) label = 'Side Panel'
        else if (avgY > 0.5 && Math.abs(avgZ) < 0.3 && avgX > -1 && avgX < 0)
          label = 'Cockpit Surround'
        else if (avgX < -2 && avgX > -3.5 && avgY > 0.3) label = 'Engine Cover Rear'
        else if (n < 100) label = 'Small Detail'
        else if (avgY > 0.3 && avgY < 0.8 && avgX > -2 && avgX < 0.5) label = 'Upper Body'
        else if (avgX > 0.5) label = 'Front Section'
        else if (avgX < -2) label = 'Rear Section'

        // pixel coordinates in the UV image (V is flipped: image top = V=1)
        const pixelX = Math.round(avgU * 4096)
        const pixelY = Math.round((1 - avgV) * 4096)

        console.log(
          `    [${n}v] UV center=(${avgU.toFixed(3)}, ${avgV.toFixed(3)}) px=(${pixelX}, ${pixelY}) | 3D=(${avgX.toFixed(2)}, ${avgY.toFixed(2)}, ${avgZ.toFixed(2)}) → ${label}`,
        )
      }
    }
  }
}

main().catch(console.error)
