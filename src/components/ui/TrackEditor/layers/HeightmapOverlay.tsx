import { useMemo } from 'react'
import { useTerrainStore } from '@/stores/useTerrainStore'
import type { Viewport } from '../geometry/viewport'

const CONTOUR_STEP = 1
const INDEX_CONTOUR_EVERY = 5
const LABEL_SPACING_WORLD = 180

type Segment = [number, number, number, number]

function lerpEdge(
  ha: number,
  hb: number,
  level: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): [number, number] {
  const denom = hb - ha
  const t = Math.abs(denom) < 1e-9 ? 0.5 : (level - ha) / denom
  const clamped = Math.max(0, Math.min(1, t))
  return [ax + (bx - ax) * clamped, ay + (by - ay) * clamped]
}

function marchingSquares(
  heightmap: Float32Array,
  resolution: number,
  worldSize: number,
  level: number,
  out: Segment[],
): void {
  const cellSize = worldSize / (resolution - 1)
  const halfSize = worldSize / 2

  for (let gz = 0; gz < resolution - 1; gz++) {
    for (let gx = 0; gx < resolution - 1; gx++) {
      const i = gz * resolution + gx
      const h00 = heightmap[i]!
      const h10 = heightmap[i + 1]!
      const h01 = heightmap[i + resolution]!
      const h11 = heightmap[i + resolution + 1]!

      const maxH = Math.max(h00, h10, h01, h11)
      const minH = Math.min(h00, h10, h01, h11)
      if (level < minH || level > maxH) continue

      let code = 0
      if (h00 >= level) code |= 1
      if (h10 >= level) code |= 2
      if (h11 >= level) code |= 4
      if (h01 >= level) code |= 8
      if (code === 0 || code === 15) continue

      const x0 = gx * cellSize - halfSize
      const y0 = gz * cellSize - halfSize
      const x1 = x0 + cellSize
      const y1 = y0 + cellSize

      const eBottom = () => lerpEdge(h00, h10, level, x0, y0, x1, y0)
      const eRight = () => lerpEdge(h10, h11, level, x1, y0, x1, y1)
      const eTop = () => lerpEdge(h01, h11, level, x0, y1, x1, y1)
      const eLeft = () => lerpEdge(h00, h01, level, x0, y0, x0, y1)

      switch (code) {
        case 1:
        case 14: {
          const a = eBottom()
          const b = eLeft()
          out.push([a[0], a[1], b[0], b[1]])
          break
        }
        case 2:
        case 13: {
          const a = eBottom()
          const b = eRight()
          out.push([a[0], a[1], b[0], b[1]])
          break
        }
        case 4:
        case 11: {
          const a = eRight()
          const b = eTop()
          out.push([a[0], a[1], b[0], b[1]])
          break
        }
        case 8:
        case 7: {
          const a = eTop()
          const b = eLeft()
          out.push([a[0], a[1], b[0], b[1]])
          break
        }
        case 3:
        case 12: {
          const a = eLeft()
          const b = eRight()
          out.push([a[0], a[1], b[0], b[1]])
          break
        }
        case 6:
        case 9: {
          const a = eBottom()
          const b = eTop()
          out.push([a[0], a[1], b[0], b[1]])
          break
        }
        case 5: {
          const a = eBottom()
          const b = eRight()
          out.push([a[0], a[1], b[0], b[1]])
          const c = eTop()
          const d = eLeft()
          out.push([c[0], c[1], d[0], d[1]])
          break
        }
        case 10: {
          const a = eBottom()
          const b = eLeft()
          out.push([a[0], a[1], b[0], b[1]])
          const c = eTop()
          const d = eRight()
          out.push([c[0], c[1], d[0], d[1]])
          break
        }
      }
    }
  }
}

function segmentsToPathD(segments: Segment[]): string {
  if (segments.length === 0) return ''
  const parts: string[] = []
  for (const s of segments) {
    parts.push(`M${s[0].toFixed(2)} ${s[1].toFixed(2)}L${s[2].toFixed(2)} ${s[3].toFixed(2)}`)
  }
  return parts.join('')
}

type Label = { x: number; y: number; text: string; angle: number }

function pickLabels(segments: Segment[], level: number): Label[] {
  if (segments.length === 0) return []
  const labels: Label[] = []
  const spacingSq = LABEL_SPACING_WORLD * LABEL_SPACING_WORLD
  for (const s of segments) {
    const mx = (s[0] + s[2]) / 2
    const my = (s[1] + s[3]) / 2
    let tooClose = false
    for (const L of labels) {
      const dx = L.x - mx
      const dy = L.y - my
      if (dx * dx + dy * dy < spacingSq) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue
    const angle = Math.atan2(s[3] - s[1], s[2] - s[0])
    let deg = (angle * 180) / Math.PI
    if (deg > 90) deg -= 180
    if (deg < -90) deg += 180
    labels.push({ x: mx, y: my, text: `${level}m`, angle: deg })
  }
  return labels
}

function buildContours(
  heightmap: Float32Array,
  resolution: number,
  worldSize: number,
): { minor: string; major: string; labels: Label[] } {
  let minH = Infinity
  let maxH = -Infinity
  for (let i = 0; i < heightmap.length; i++) {
    const h = heightmap[i]!
    if (h < minH) minH = h
    if (h > maxH) maxH = h
  }
  if (!isFinite(minH) || !isFinite(maxH) || maxH - minH < 0.01) {
    return { minor: '', major: '', labels: [] }
  }

  const minLevel = Math.ceil(minH / CONTOUR_STEP)
  const maxLevel = Math.floor(maxH / CONTOUR_STEP)

  const minorSegs: Segment[] = []
  const majorSegs: Segment[] = []
  const labels: Label[] = []

  for (let k = minLevel; k <= maxLevel; k++) {
    const level = k * CONTOUR_STEP
    const isMajor = k % INDEX_CONTOUR_EVERY === 0
    if (isMajor) {
      const levelSegs: Segment[] = []
      marchingSquares(heightmap, resolution, worldSize, level, levelSegs)
      for (const s of levelSegs) majorSegs.push(s)
      labels.push(...pickLabels(levelSegs, level))
    } else {
      marchingSquares(heightmap, resolution, worldSize, level, minorSegs)
    }
  }

  return {
    minor: segmentsToPathD(minorSegs),
    major: segmentsToPathD(majorSegs),
    labels,
  }
}

export function selectHeightmapOverlayVersion(version: number, suspendUpdates: boolean): number {
  return suspendUpdates ? 0 : version
}

export default function HeightmapOverlay({
  viewport,
  suspendUpdates = false,
}: {
  viewport: Viewport
  suspendUpdates?: boolean
}) {
  const resolution = useTerrainStore(s => s.resolution)
  const worldSize = useTerrainStore(s => s.worldSize)
  const version = useTerrainStore(s => selectHeightmapOverlayVersion(s.version, suspendUpdates))

  const { minor, major, labels } = useMemo(() => {
    const heightmap = useTerrainStore.getState().heightmap
    return buildContours(heightmap, resolution, worldSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution, worldSize, version])

  if (!minor && !major) return null

  const transform = `translate(${viewport.pan.x} ${viewport.pan.y}) scale(${viewport.zoom})`

  return (
    <g transform={transform} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      {minor && (
        <path
          d={minor}
          stroke='rgba(255,255,255,0.35)'
          strokeWidth={1}
          fill='none'
          vectorEffect='non-scaling-stroke'
        />
      )}
      {major && (
        <path
          d={major}
          stroke='rgba(250,210,120,0.9)'
          strokeWidth={1.5}
          fill='none'
          vectorEffect='non-scaling-stroke'
        />
      )}
      {labels.map((L, i) => (
        <g key={i} transform={`translate(${L.x} ${L.y}) rotate(${L.angle})`}>
          <text
            x={0}
            y={0}
            textAnchor='middle'
            dominantBaseline='central'
            fill='rgba(250,210,120,1)'
            fontSize={10 / viewport.zoom}
            style={{
              paintOrder: 'stroke',
              stroke: 'rgba(14,16,22,0.92)',
              strokeWidth: 3 / viewport.zoom,
              strokeLinejoin: 'round',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontWeight: 600,
            }}
          >
            {L.text}
          </text>
        </g>
      ))}
    </g>
  )
}
