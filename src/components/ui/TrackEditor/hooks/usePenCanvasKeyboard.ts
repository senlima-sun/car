import { useEffect, useState } from 'react'
import { useTrackEditorStore } from '../state/useTrackEditorStore'

const PAN_SPEED_PX_PER_SEC = 900

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

export function usePenCanvasKeyboard(): { spaceDown: boolean } {
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
  }, [spaceDown])

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
