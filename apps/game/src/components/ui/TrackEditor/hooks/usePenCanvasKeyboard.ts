import { useEffect, useState, type RefObject } from 'react'
import { useTrackEditorStore } from '../state/useTrackEditorStore'
import { rotateAt } from '../geometry/viewport'

const PAN_SPEED_PX_PER_SEC = 900
const ROTATE_STEP_RAD = (15 * Math.PI) / 180

function isPanKey(key: string): boolean {
  return (
    key === 'w' ||
    key === 'a' ||
    key === 's' ||
    key === 'd' ||
    key === 'W' ||
    key === 'A' ||
    key === 'S' ||
    key === 'D'
  )
}

function screenCenter(svg: SVGSVGElement | null): { x: number; y: number } {
  if (!svg) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  return { x: rect.width / 2, y: rect.height / 2 }
}

export function usePenCanvasKeyboard(
  svgRef?: RefObject<SVGSVGElement | null>,
): { spaceDown: boolean } {
  const [spaceDown, setSpaceDown] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.code === 'Space') {
        if (!spaceDown) setSpaceDown(true)
        e.preventDefault()
      } else if (e.key === 'Escape') {
        useTrackEditorStore.getState().cancelActivePath()
      } else if (e.key === 'Enter') {
        useTrackEditorStore.getState().finishActivePath()
      } else if (e.key === '[' || e.key === ']') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const delta = e.key === ']' ? ROTATE_STEP_RAD : -ROTATE_STEP_RAD
        const pivot = screenCenter(svgRef?.current ?? null)
        useTrackEditorStore.getState().setViewport(v => rotateAt(v, pivot, delta))
        e.preventDefault()
      } else if (e.key === '0') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const pivot = screenCenter(svgRef?.current ?? null)
        useTrackEditorStore
          .getState()
          .setViewport(v => rotateAt(v, pivot, -v.rotation))
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [spaceDown, svgRef])

  useEffect(() => {
    const pressed = new Set<string>()
    let rafId: number | null = null
    let lastTime = 0

    const step = (now: number) => {
      if (pressed.size === 0) {
        rafId = null
        lastTime = 0
        return
      }
      const dt = lastTime === 0 ? 16 : Math.min(48, now - lastTime)
      lastTime = now
      const speed = PAN_SPEED_PX_PER_SEC * (dt / 1000)
      let dx = 0
      let dy = 0
      if (pressed.has('a')) dx += speed
      if (pressed.has('d')) dx -= speed
      if (pressed.has('w')) dy += speed
      if (pressed.has('s')) dy -= speed
      if (dx !== 0 || dy !== 0) {
        useTrackEditorStore.getState().setViewport(v => ({
          ...v,
          pan: { x: v.pan.x + dx, y: v.pan.y + dy },
        }))
      }
      rafId = requestAnimationFrame(step)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!isPanKey(e.key)) return
      const key = e.key.toLowerCase()
      if (!pressed.has(key)) pressed.add(key)
      if (rafId === null) rafId = requestAnimationFrame(step)
      e.preventDefault()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isPanKey(e.key)) return
      pressed.delete(e.key.toLowerCase())
    }

    const onBlur = () => pressed.clear()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  return { spaceDown }
}
