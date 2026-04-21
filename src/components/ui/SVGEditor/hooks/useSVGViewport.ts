import { useState, useCallback, useRef, useEffect, type RefObject } from 'react'

export interface ViewportState {
  centerX: number
  centerY: number
  zoom: number
}

const MIN_ZOOM = 0.1
const MAX_ZOOM = 20
const ZOOM_FACTOR = 1.1

export function useSVGViewport(svgRef: RefObject<SVGSVGElement | null>) {
  const [viewport, setViewport] = useState<ViewportState>({
    centerX: 0,
    centerY: 0,
    zoom: 1,
  })

  const panState = useRef<{
    isPanning: boolean
    startX: number
    startY: number
    startCenterX: number
    startCenterY: number
  }>({ isPanning: false, startX: 0, startY: 0, startCenterX: 0, startCenterY: 0 })

  const spaceHeld = useRef(false)
  const keysHeld = useRef(new Set<string>())
  const keyPanRAF = useRef<number>(0)

  const PAN_SPEED = 600

  const getViewBox = useCallback((): string => {
    const svg = svgRef.current
    if (!svg) return '-500 -500 1000 1000'

    const { width: svgW, height: svgH } = svg.getBoundingClientRect()
    const w = svgW / viewport.zoom
    const h = svgH / viewport.zoom

    const x = viewport.centerX - w / 2
    const y = viewport.centerY - h / 2

    return `${x} ${y} ${w} ${h}`
  }, [viewport, svgRef])

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      const svg = svgRef.current
      if (!svg) return

      const ctm = svg.getScreenCTM()
      if (!ctm) return

      const inv = ctm.inverse()
      const svgX = inv.a * e.clientX + inv.c * e.clientY + inv.e
      const svgY = inv.b * e.clientX + inv.d * e.clientY + inv.f

      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR

      setViewport(prev => {
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor))
        const scale = newZoom / prev.zoom

        const newCenterX = svgX + (prev.centerX - svgX) / scale
        const newCenterY = svgY + (prev.centerY - svgY) / scale

        return { centerX: newCenterX, centerY: newCenterY, zoom: newZoom }
      })
    },
    [svgRef],
  )

  const startPan = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
        panState.current = {
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY,
          startCenterX: viewport.centerX,
          startCenterY: viewport.centerY,
        }
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        e.preventDefault()
      }
    },
    [viewport.centerX, viewport.centerY],
  )

  const updatePan = useCallback(
    (e: React.PointerEvent) => {
      if (!panState.current.isPanning) return

      const dx = (e.clientX - panState.current.startX) / viewport.zoom
      const dy = (e.clientY - panState.current.startY) / viewport.zoom

      setViewport(prev => ({
        ...prev,
        centerX: panState.current.startCenterX - dx,
        centerY: panState.current.startCenterY - dy,
      }))
    },
    [viewport.zoom, svgRef],
  )

  const endPan = useCallback(() => {
    panState.current.isPanning = false
  }, [])

  const isPanning = useCallback(() => panState.current.isPanning, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [svgRef, handleWheel])

  useEffect(() => {
    let lastTime = 0

    const tick = (time: number) => {
      const keys = keysHeld.current
      if (keys.size === 0) {
        lastTime = 0
        keyPanRAF.current = 0
        return
      }

      const dt = lastTime ? (time - lastTime) / 1000 : 1 / 60
      lastTime = time

      let dx = 0
      let dy = 0
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy)
        dx /= len
        dy /= len

        setViewport(prev => ({
          ...prev,
          centerX: prev.centerX + (dx * PAN_SPEED * dt) / prev.zoom,
          centerY: prev.centerY + (dy * PAN_SPEED * dt) / prev.zoom,
        }))
      }

      keyPanRAF.current = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (!keyPanRAF.current && keysHeld.current.size > 0) {
        lastTime = 0
        keyPanRAF.current = requestAnimationFrame(tick)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') spaceHeld.current = true

      const wasd = [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ]
      if (wasd.includes(e.code)) {
        e.preventDefault()
        keysHeld.current.add(e.code)
        startLoop()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false
      keysHeld.current.delete(e.code)
    }

    const handleBlur = () => {
      keysHeld.current.clear()
      spaceHeld.current = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      if (keyPanRAF.current) cancelAnimationFrame(keyPanRAF.current)
    }
  }, [])

  const fitToContent = useCallback(
    (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const contentW = bounds.maxX - bounds.minX || 100
      const contentH = bounds.maxY - bounds.minY || 100

      const padFactor = 1.2
      const zoomX = rect.width / (contentW * padFactor)
      const zoomY = rect.height / (contentH * padFactor)
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)))

      setViewport({
        centerX: (bounds.minX + bounds.maxX) / 2,
        centerY: (bounds.minY + bounds.maxY) / 2,
        zoom,
      })
    },
    [svgRef],
  )

  return {
    viewport,
    setViewport,
    getViewBox,
    startPan,
    updatePan,
    endPan,
    isPanning,
    fitToContent,
  }
}
