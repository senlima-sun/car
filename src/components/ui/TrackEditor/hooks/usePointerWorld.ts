import type { Point } from '../geometry/types'

export function screenPointOf(
  e: { clientX: number; clientY: number },
  svgEl: SVGSVGElement | null,
): Point {
  if (!svgEl) return { x: 0, y: 0 }
  const rect = svgEl.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
