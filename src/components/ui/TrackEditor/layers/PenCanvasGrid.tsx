import { useEffect, useState, type RefObject } from 'react'
import type { Viewport } from '../geometry/viewport'

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
  const ox = ((viewport.pan.x % pxStep) + pxStep) % pxStep
  const oy = ((viewport.pan.y % pxStep) + pxStep) % pxStep
  const lines: React.ReactNode[] = []
  for (let x = ox; x < size.w; x += pxStep) {
    lines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={size.h} stroke='#171717' strokeWidth={1} />,
    )
  }
  for (let y = oy; y < size.h; y += pxStep) {
    lines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={size.w} y2={y} stroke='#171717' strokeWidth={1} />,
    )
  }
  const ax = viewport.pan.x
  const ay = viewport.pan.y
  return (
    <g>
      {lines}
      <line x1={ax} y1={0} x2={ax} y2={size.h} stroke='#262626' strokeWidth={1} />
      <line x1={0} y1={ay} x2={size.w} y2={ay} stroke='#262626' strokeWidth={1} />
    </g>
  )
}
