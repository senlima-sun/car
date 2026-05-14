import { useEffect, useState, type RefObject } from 'react'
import { worldToScreen, type Viewport } from '../geometry/viewport'

type Props = {
  viewport: Viewport
  svgRef: RefObject<SVGSVGElement | null>
}

export default function PenCanvasGrid({ viewport, svgRef }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [svgRef])
  if (!size.w || !size.h) return null
  const base = 50
  let step = base
  while (step * viewport.zoom < 20) step *= 5
  while (step * viewport.zoom > 200) step /= 5
  const pxStep = step * viewport.zoom
  const cx = size.w / 2
  const cy = size.h / 2
  const diag = Math.ceil(Math.hypot(size.w, size.h)) + pxStep * 2
  const half = Math.ceil(diag / 2)
  const baseScreen = worldToScreen(viewport, { x: 0, y: 0 })
  const cos = Math.cos(viewport.rotation)
  const sin = Math.sin(viewport.rotation)
  const localOriginX = (baseScreen.x - cx) * cos + (baseScreen.y - cy) * sin
  const localOriginY = -(baseScreen.x - cx) * sin + (baseScreen.y - cy) * cos
  const ox = ((localOriginX % pxStep) + pxStep) % pxStep
  const oy = ((localOriginY % pxStep) + pxStep) % pxStep
  const startX = ox - half
  const startY = oy - half
  const lines: React.ReactNode[] = []
  for (let x = startX; x <= half; x += pxStep) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={-half}
        x2={x}
        y2={half}
        stroke='#171717'
        strokeWidth={1}
      />,
    )
  }
  for (let y = startY; y <= half; y += pxStep) {
    lines.push(
      <line
        key={`h${y}`}
        x1={-half}
        y1={y}
        x2={half}
        y2={y}
        stroke='#171717'
        strokeWidth={1}
      />,
    )
  }
  lines.push(
    <line
      key='axis-x'
      x1={localOriginX}
      y1={-half}
      x2={localOriginX}
      y2={half}
      stroke='#262626'
      strokeWidth={1}
    />,
    <line
      key='axis-y'
      x1={-half}
      y1={localOriginY}
      x2={half}
      y2={localOriginY}
      stroke='#262626'
      strokeWidth={1}
    />,
  )
  const rotDeg = (viewport.rotation * 180) / Math.PI
  return <g transform={`translate(${cx} ${cy}) rotate(${rotDeg})`}>{lines}</g>
}
