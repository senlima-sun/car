import { useCallback, useRef } from 'react'

export function worldToSVG(worldX: number, worldZ: number): [number, number] {
  return [worldX, -worldZ]
}

export function svgToWorld(svgX: number, svgY: number): [number, number, number] {
  return [svgX, 0, -svgY]
}

export function useSVGCoordinates() {
  const svgRef = useRef<SVGSVGElement>(null)

  const screenToSVG = useCallback((screenX: number, screenY: number): [number, number] | null => {
    const svg = svgRef.current
    if (!svg) return null

    const ctm = svg.getScreenCTM()
    if (!ctm) return null

    const inv = ctm.inverse()
    const svgX = inv.a * screenX + inv.c * screenY + inv.e
    const svgY = inv.b * screenX + inv.d * screenY + inv.f

    return [svgX, svgY]
  }, [])

  const screenToWorld = useCallback(
    (screenX: number, screenY: number): [number, number, number] | null => {
      const svgPt = screenToSVG(screenX, screenY)
      if (!svgPt) return null
      return svgToWorld(svgPt[0], svgPt[1])
    },
    [screenToSVG],
  )

  return { svgRef, screenToSVG, screenToWorld, worldToSVG, svgToWorld }
}
