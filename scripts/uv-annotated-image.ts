import { NodeIO } from '@gltf-transform/core'
import { KHRDracoMeshCompression } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import fs from 'fs'
import path from 'path'

const MODEL_PATH = path.resolve('public/models/f1_2026.glb')
const SIZE = 4096

const PART_COLORS: Record<string, string> = {
  'Front Wing': '#FF4444',
  'Nose Cone': '#FF8800',
  'Cockpit Surround': '#FFDD00',
  Halo: '#AAFF00',
  Sidepod: '#00FF44',
  'Engine Cover': '#00FFAA',
  'Airbox / Roll Hoop': '#00DDFF',
  'Shark Fin': '#0088FF',
  'Rear Wing': '#4400FF',
  Diffuser: '#AA00FF',
  'Floor / Underbody': '#FF00AA',
  'Side Panel': '#FF6644',
  'Rear Light': '#FF0044',
  'Front Section': '#FFAA44',
  'Upper Body': '#88FF44',
  'Rear Section': '#8844FF',
  Bargeboards: '#44FFAA',
  'Small Detail': '#888888',
}

function classifyPart(
  avgX: number,
  avgY: number,
  avgZ: number,
  n: number,
  spanX: number,
  spanY: number,
  spanZ: number,
): string {
  if (avgY > 0.95) return 'Airbox / Roll Hoop'
  if (avgY > 0.7 && Math.abs(avgZ) < 0.2 && avgX < -1 && avgX > -3) return 'Shark Fin'
  if (avgY > 0.6 && Math.abs(avgZ) < 0.35 && avgX > -1.5) return 'Engine Cover'
  if (avgY > 0.5 && Math.abs(avgZ) > 0.5) return 'Sidepod'
  if (avgX > 0.4 && avgY < 0.35 && spanZ > 0.3) return 'Front Wing'
  if (avgX > 0.2 && avgY > 0.3 && avgY < 0.8 && Math.abs(avgZ) < 0.5) return 'Nose Cone'
  if (avgX < -3.5 && avgY > 0.25) return 'Rear Wing'
  if (avgX < -3 && avgY < 0.25) return 'Diffuser'
  if (avgY < 0.08 && spanX > 0.5) return 'Floor / Underbody'
  if (avgY > 0.3 && avgY < 0.65 && Math.abs(avgZ) > 0.35 && spanX > 0.8) return 'Side Panel'
  if (avgY > 0.45 && Math.abs(avgZ) < 0.35 && avgX > -1.2 && avgX < -0.2) return 'Cockpit Surround'
  if (avgX < -2.5 && avgX > -3.5 && avgY > 0.3) return 'Engine Cover'
  if (avgX > 0.3) return 'Front Section'
  if (avgX < -2.5) return 'Rear Section'
  if (avgY > 0.3) return 'Upper Body'
  if (n < 80) return 'Small Detail'
  return 'Upper Body'
}

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })

  const doc = await io.read(MODEL_PATH)
  const root = doc.getRoot()

  interface Island {
    centerU: number
    centerV: number
    label: string
    color: string
    vertCount: number
    uvMinU: number
    uvMaxU: number
    uvMinV: number
    uvMaxV: number
  }

  const allIslands: Island[] = []

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

      const visited = new Set<number>()
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
        if (cluster.length < 20) continue

        let sumU = 0,
          sumV = 0,
          sumX = 0,
          sumY = 0,
          sumZ = 0
        let minU = Infinity,
          maxU = -Infinity,
          minV = Infinity,
          maxV = -Infinity
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity,
          minZ = Infinity,
          maxZ = -Infinity

        for (const vi of cluster) {
          const u = uvs[vi * 2],
            v = uvs[vi * 2 + 1]
          const x = positions[vi * 3],
            y = positions[vi * 3 + 1],
            z = positions[vi * 3 + 2]
          sumU += u
          sumV += v
          sumX += x
          sumY += y
          sumZ += z
          minU = Math.min(minU, u)
          maxU = Math.max(maxU, u)
          minV = Math.min(minV, v)
          maxV = Math.max(maxV, v)
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
          minZ = Math.min(minZ, z)
          maxZ = Math.max(maxZ, z)
        }

        const n = cluster.length
        const avgX = sumX / n,
          avgY = sumY / n,
          avgZ = sumZ / n
        const avgU = sumU / n,
          avgV = sumV / n

        const label = classifyPart(avgX, avgY, avgZ, n, maxX - minX, maxY - minY, maxZ - minZ)
        const color = PART_COLORS[label] || '#888888'

        allIslands.push({
          centerU: avgU,
          centerV: avgV,
          label,
          color,
          vertCount: n,
          uvMinU: minU,
          uvMaxU: maxU,
          uvMinV: minV,
          uvMaxV: maxV,
        })
      }
    }
  }

  // Merge nearby islands with same label
  const merged: Island[] = []
  const used = new Set<number>()

  for (let i = 0; i < allIslands.length; i++) {
    if (used.has(i)) continue
    const group = [allIslands[i]]
    used.add(i)

    for (let j = i + 1; j < allIslands.length; j++) {
      if (used.has(j)) continue
      if (allIslands[j].label !== allIslands[i].label) continue
      const du = Math.abs(allIslands[j].centerU - allIslands[i].centerU)
      const dv = Math.abs(allIslands[j].centerV - allIslands[i].centerV)
      if (du < 0.08 && dv < 0.08) {
        group.push(allIslands[j])
        used.add(j)
      }
    }

    const totalVerts = group.reduce((s, g) => s + g.vertCount, 0)
    const avgU = group.reduce((s, g) => s + g.centerU * g.vertCount, 0) / totalVerts
    const avgV = group.reduce((s, g) => s + g.centerV * g.vertCount, 0) / totalVerts

    merged.push({
      centerU: avgU,
      centerV: avgV,
      label: group[0].label,
      color: group[0].color,
      vertCount: totalVerts,
      uvMinU: Math.min(...group.map(g => g.uvMinU)),
      uvMaxU: Math.max(...group.map(g => g.uvMaxU)),
      uvMinV: Math.min(...group.map(g => g.uvMinV)),
      uvMaxV: Math.max(...group.map(g => g.uvMaxV)),
    })
  }

  // Generate SVG overlay
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">\n`
  svg += `<style>
    text { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: bold; paint-order: stroke fill; }
    rect.region { stroke-width: 3; fill-opacity: 0.12; }
  </style>\n`

  // Sort by size so big labels are rendered first
  merged.sort((a, b) => b.vertCount - a.vertCount)

  // Filter to significant islands only
  const significant = merged.filter(m => m.vertCount >= 50 && m.label !== 'Small Detail')

  for (const island of significant) {
    const x1 = Math.round(island.uvMinU * SIZE)
    const y1 = Math.round((1 - island.uvMaxV) * SIZE)
    const x2 = Math.round(island.uvMaxU * SIZE)
    const y2 = Math.round((1 - island.uvMinV) * SIZE)
    const cx = Math.round(island.centerU * SIZE)
    const cy = Math.round((1 - island.centerV) * SIZE)

    const w = x2 - x1
    const h = y2 - y1

    if (w < 20 || h < 20) continue

    svg += `  <rect class="region" x="${x1}" y="${y1}" width="${w}" height="${h}" stroke="${island.color}" fill="${island.color}" />\n`
    svg += `  <circle cx="${cx}" cy="${cy}" r="8" fill="${island.color}" />\n`

    const fontSize = Math.max(28, Math.min(48, Math.round(Math.sqrt(island.vertCount) * 1.5)))
    svg += `  <text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="${island.color}" stroke="black" stroke-width="4" font-size="${fontSize}">${island.label}</text>\n`
    svg += `  <text x="${cx}" y="${cy + fontSize - 8}" text-anchor="middle" fill="white" stroke="black" stroke-width="3" font-size="${Math.round(fontSize * 0.6)}">${island.vertCount}v</text>\n`
  }

  svg += '</svg>\n'

  const svgPath = path.resolve('uv_layout_annotated.svg')
  fs.writeFileSync(svgPath, svg)
  console.log(`SVG overlay written to ${svgPath}`)

  // Also output a legend
  console.log('\n=== PART LEGEND ===')
  const partSummary = new Map<string, number>()
  for (const m of merged) {
    partSummary.set(m.label, (partSummary.get(m.label) || 0) + m.vertCount)
  }
  for (const [label, verts] of [...partSummary.entries()].sort((a, b) => b[1] - a[1])) {
    const color = PART_COLORS[label] || '#888'
    console.log(`  ${color} ${label}: ${verts} verts`)
  }

  // Generate a combined annotated list for the spec doc
  console.log('\n=== UV REGION TABLE (for markdown) ===')
  console.log('| Part | UV Center (U, V) | Pixel (X, Y) | Approx UV Box | Verts |')
  console.log('|------|-----------------|-------------|---------------|-------|')
  for (const island of significant.sort((a, b) => b.vertCount - a.vertCount)) {
    const px = Math.round(island.centerU * SIZE)
    const py = Math.round((1 - island.centerV) * SIZE)
    const box = `(${island.uvMinU.toFixed(2)}–${island.uvMaxU.toFixed(2)}, ${island.uvMinV.toFixed(2)}–${island.uvMaxV.toFixed(2)})`
    console.log(
      `| ${island.label} | (${island.centerU.toFixed(3)}, ${island.centerV.toFixed(3)}) | (${px}, ${py}) | ${box} | ${island.vertCount} |`,
    )
  }
}

main().catch(console.error)
