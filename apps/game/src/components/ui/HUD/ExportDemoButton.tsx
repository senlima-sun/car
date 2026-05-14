import { useState } from 'react'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { ghostBuffersToDemo } from '@/utils/aiDemoSchema'

type ExportState = 'idle' | 'exported' | 'error'

function resolveTrackSlug(): string | null {
  const trackState = useTrackStore.getState()
  const active = trackState.getActiveTrack()
  if (active?.presetId) return active.presetId
  return trackState.trackLibrary.activeTrackId ?? null
}

export function ExportDemoButton() {
  const [state, setState] = useState<ExportState>('idle')
  const frameCount = useGhostCarStore(s => s.ghostHead)
  const lastLapTime = useLapTimeStore(s => s.lastLapTime)

  const slug = resolveTrackSlug()
  const disabled = frameCount === 0 || slug === null || lastLapTime === null

  const tooltip = (() => {
    if (frameCount === 0) return 'Drive a clean lap first — recording requires useLapTimeStore.isRecording=true'
    if (slug === null) return 'No active track selected'
    if (lastLapTime === null) return 'Complete a lap before exporting'
    return `Export ${frameCount} recorded frames as ${slug}.demo.json`
  })()

  const handleExport = () => {
    if (disabled || slug === null || lastLapTime === null) {
      setState('error')
      return
    }
    try {
      const buffers = useGhostCarStore.getState().getGhostBuffers()
      const demo = ghostBuffersToDemo(slug, lastLapTime, buffers)
      const json = JSON.stringify(demo, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${slug}.demo.json`
      anchor.rel = 'noopener'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      setState('exported')
    } catch (err) {
      console.warn('[demo-export] failed', err)
      setState('error')
    }
  }

  const label = (() => {
    if (state === 'exported') return `Exported ${frameCount} frames`
    if (state === 'error') return 'Export failed'
    if (frameCount === 0) return 'Export demo JSON (drive a lap)'
    return `Export demo JSON (${frameCount} frames)`
  })()

  return (
    <div className="pointer-events-auto fixed left-4 top-28 z-50 flex flex-col gap-2 rounded-md bg-black/70 p-3 text-xs text-white shadow-lg">
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled}
        title={tooltip}
        className="rounded bg-emerald-600 px-3 py-1.5 font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
      <p className="max-w-[18rem] text-[10px] leading-snug text-neutral-300">
        Move the downloaded file to{' '}
        <code className="rounded bg-neutral-800 px-1">
          apps/game/public/demos/{slug ?? '<trackId>'}.demo.json
        </code>{' '}
        before training.
      </p>
    </div>
  )
}
