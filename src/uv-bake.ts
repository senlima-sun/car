import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const SIZE = 4096
const canvas = document.getElementById('uvCanvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d', { willReadFrequently: true })!
const status = document.getElementById('status')!
const tooltip = document.getElementById('tooltip')!
const selectedPartLabel = document.getElementById('selectedPart')!
const colorPicker = document.getElementById('colorPicker') as HTMLInputElement
const fileInput = document.getElementById('fileInput') as HTMLInputElement

// --- Union-Find for triangle islands ---
let ufParent: Int32Array
let ufRank: Int32Array

function ufInit(n: number) {
  ufParent = new Int32Array(n)
  ufRank = new Int32Array(n)
  for (let i = 0; i < n; i++) ufParent[i] = i
}

function ufFind(x: number): number {
  while (ufParent[x] !== x) {
    ufParent[x] = ufParent[ufParent[x]]
    x = ufParent[x]
  }
  return x
}

function ufUnion(a: number, b: number) {
  a = ufFind(a)
  b = ufFind(b)
  if (a === b) return
  if (ufRank[a] < ufRank[b]) {
    const t = a
    a = b
    b = t
  }
  ufParent[b] = a
  if (ufRank[a] === ufRank[b]) ufRank[a]++
}

interface TriRecord {
  pu0: number
  pv0: number
  pu1: number
  pv1: number
  pu2: number
  pv2: number
  island: number
}

const triRecords: TriRecord[] = []
const GRID = 1024
const gridData = new Int32Array(GRID * GRID).fill(-1)
const islandTris = new Map<number, number[]>()
const islandColors = new Map<number, string>()

const PALETTE = [
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#1abc9c',
  '#3498db',
  '#9b59b6',
  '#e84393',
  '#fd79a8',
  '#00cec9',
  '#6c5ce7',
  '#d63031',
  '#e17055',
  '#00b894',
  '#0984e3',
  '#a29bfe',
  '#ffeaa7',
  '#dfe6e9',
  '#fab1a0',
  '#74b9ff',
]

function rasterizeToGrid() {
  for (let i = 0; i < triRecords.length; i++) {
    const t = triRecords[i]
    const gx0 = Math.max(
      0,
      Math.min(GRID - 1, Math.floor((Math.min(t.pu0, t.pu1, t.pu2) / SIZE) * GRID)),
    )
    const gy0 = Math.max(
      0,
      Math.min(GRID - 1, Math.floor((Math.min(t.pv0, t.pv1, t.pv2) / SIZE) * GRID)),
    )
    const gx1 = Math.max(
      0,
      Math.min(GRID - 1, Math.floor((Math.max(t.pu0, t.pu1, t.pu2) / SIZE) * GRID)),
    )
    const gy1 = Math.max(
      0,
      Math.min(GRID - 1, Math.floor((Math.max(t.pv0, t.pv1, t.pv2) / SIZE) * GRID)),
    )
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        gridData[gy * GRID + gx] = i
      }
    }
  }
}

function buildIslands() {
  islandTris.clear()
  for (let i = 0; i < triRecords.length; i++) {
    const root = ufFind(i)
    triRecords[i].island = root
    if (!islandTris.has(root)) islandTris.set(root, [])
    islandTris.get(root)!.push(i)
  }
}

function paintIsland(island: number, color: string) {
  const indices = islandTris.get(island)
  if (!indices) return
  ctx.fillStyle = color
  for (const i of indices) {
    const t = triRecords[i]
    ctx.beginPath()
    ctx.moveTo(t.pu0, t.pv0)
    ctx.lineTo(t.pu1, t.pv1)
    ctx.lineTo(t.pu2, t.pv2)
    ctx.closePath()
    ctx.fill()
  }
}

function drawWireframe() {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  for (const t of triRecords) {
    ctx.beginPath()
    ctx.moveTo(t.pu0, t.pv0)
    ctx.lineTo(t.pu1, t.pv1)
    ctx.lineTo(t.pu2, t.pv2)
    ctx.closePath()
    ctx.stroke()
  }
}

function drawPaint() {
  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, SIZE, SIZE)

  let colorIdx = 0
  for (const [island] of islandTris) {
    const color = islandColors.get(island) ?? PALETTE[colorIdx % PALETTE.length]
    paintIsland(island, color)
    if (!islandColors.has(island)) colorIdx++
  }
}

function redrawAll() {
  drawPaint()
  drawWireframe()
}

// --- GLB loading ---
const loader = new GLTFLoader()
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
loader.setDRACOLoader(dracoLoader)

loader.load(
  '/models/f1_2026.glb',
  gltf => {
    status.textContent = 'Building UV islands...'

    // Collect all triangles with their vertex indices (global)
    const allTris: {
      vi0: number
      vi1: number
      vi2: number
      u0: number
      v0: number
      u1: number
      v1: number
      u2: number
      v2: number
    }[] = []
    let vertexOffset = 0

    gltf.scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      if (!child.name.startsWith('Car_Livery')) return

      const geo = child.geometry
      const posAttr = geo.getAttribute('position')
      const uvAttr = geo.getAttribute('uv')
      const index = geo.index
      if (!posAttr || !uvAttr) return

      const triCount = index ? index.count / 3 : posAttr.count / 3

      for (let t = 0; t < triCount; t++) {
        const i0 = index ? index.getX(t * 3) : t * 3
        const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
        const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2

        const u0 = uvAttr.getX(i0),
          v0 = uvAttr.getY(i0)
        const u1 = uvAttr.getX(i1),
          v1 = uvAttr.getY(i1)
        const u2 = uvAttr.getX(i2),
          v2 = uvAttr.getY(i2)

        const maxEdge = Math.max(
          Math.hypot(u1 - u0, v1 - v0),
          Math.hypot(u2 - u1, v2 - v1),
          Math.hypot(u0 - u2, v0 - v2),
        )
        if (maxEdge > 0.04) continue

        allTris.push({
          vi0: vertexOffset + i0,
          vi1: vertexOffset + i1,
          vi2: vertexOffset + i2,
          u0,
          v0,
          u1,
          v1,
          u2,
          v2,
        })
      }

      vertexOffset += posAttr.count
    })

    // Union-Find: triangles sharing a vertex belong to same island
    ufInit(allTris.length)
    const vertexToTri = new Map<number, number>()
    for (let i = 0; i < allTris.length; i++) {
      const tri = allTris[i]
      for (const vi of [tri.vi0, tri.vi1, tri.vi2]) {
        if (vertexToTri.has(vi)) {
          ufUnion(i, vertexToTri.get(vi)!)
        } else {
          vertexToTri.set(vi, i)
        }
      }
    }

    // Build triRecords
    for (const tri of allTris) {
      triRecords.push({
        pu0: tri.u0 * SIZE,
        pv0: (1 - tri.v0) * SIZE,
        pu1: tri.u1 * SIZE,
        pv1: (1 - tri.v1) * SIZE,
        pu2: tri.u2 * SIZE,
        pv2: (1 - tri.v2) * SIZE,
        island: -1,
      })
    }

    buildIslands()
    rasterizeToGrid()
    redrawAll()

    const islandCount = islandTris.size
    status.textContent = `${allTris.length} tris, ${islandCount} islands — click to paint`
  },
  undefined,
  err => {
    status.textContent = `Error: ${err}`
  },
)

// --- Hover tooltip ---
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect()
  const gx = Math.floor(((e.clientX - rect.left) / rect.width) * GRID)
  const gy = Math.floor(((e.clientY - rect.top) / rect.height) * GRID)

  if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) {
    tooltip.style.display = 'none'
    return
  }

  const idx = gridData[gy * GRID + gx]
  if (idx >= 0) {
    const island = triRecords[idx].island
    const count = islandTris.get(island)?.length ?? 0
    tooltip.style.display = 'block'
    tooltip.style.left = `${e.clientX + 15}px`
    tooltip.style.top = `${e.clientY + 15}px`
    tooltip.textContent = `Island ${island} (${count} tris)`
  } else {
    tooltip.style.display = 'none'
  }
})

canvas.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none'
})

// --- Click to paint island ---
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect()
  const gx = Math.floor(((e.clientX - rect.left) / rect.width) * GRID)
  const gy = Math.floor(((e.clientY - rect.top) / rect.height) * GRID)
  if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) return

  const idx = gridData[gy * GRID + gx]
  if (idx < 0) return

  const island = triRecords[idx].island
  const color = colorPicker.value
  islandColors.set(island, color)
  redrawAll()
  const count = islandTris.get(island)?.length ?? 0
  selectedPartLabel.textContent = `Painted island ${island} (${count} tris)`
})

function getCleanBlob(): Promise<Blob> {
  drawPaint()
  return new Promise<Blob>(resolve => {
    canvas.toBlob(b => {
      redrawAll()
      resolve(b!)
    }, 'image/png')
  })
}

// --- Export ---
document.getElementById('exportPNG')!.addEventListener('click', async () => {
  const blob = await getCleanBlob()
  const link = document.createElement('a')
  link.download = 'Livery_baseColor.png'
  link.href = URL.createObjectURL(blob)
  link.click()
  URL.revokeObjectURL(link.href)
})

// --- Save to Game ---
document.getElementById('saveToGame')!.addEventListener('click', async () => {
  const btn = document.getElementById('saveToGame') as HTMLButtonElement
  btn.textContent = 'Saving...'
  btn.disabled = true
  try {
    const blob = await getCleanBlob()
    const resp = await fetch('/api/save-livery', {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: blob,
    })
    btn.textContent = resp.ok ? 'Saved!' : 'Error!'
  } catch {
    btn.textContent = 'Error!'
  }
  setTimeout(() => {
    btn.textContent = 'Save to Game'
    btn.disabled = false
  }, 1500)
})

// --- Load PNG ---
document.getElementById('loadPNG')!.addEventListener('click', () => fileInput.click())

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (!file) return
  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(img, 0, 0, SIZE, SIZE)
    drawWireframe()
    URL.revokeObjectURL(img.src)
    status.textContent = `Loaded: ${file.name}`
  }
  img.src = URL.createObjectURL(file)
  fileInput.value = ''
})
