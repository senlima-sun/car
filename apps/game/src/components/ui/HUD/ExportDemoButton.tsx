import { useState } from 'react'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { ghostBuffersToDemo } from '@/utils/aiDemoSchema'
import { useFeatureGate } from '@/auth/useFeatureGate'
import { Surface } from '@/components/ui/primitives'

type ExportState = 'idle' | 'exported' | 'error'

function resolveTrackSlug(): string | null {
  const trackState = useTrackStore.getState()
  const active = trackState.getActiveTrack()
  if (active?.presetId) return active.presetId
  return trackState.trackLibrary.activeTrackId ?? null
}

export function ExportDemoButton() {
  const [state, setState] = useState<ExportState>('idle')
  const lastLap = useGhostCarStore(s => s.lastCompletedLap)
  const exportGate = useFeatureGate('telemetryExport')

  const slug = resolveTrackSlug()
  const completedFrames = lastLap?.buffers.frameCount ?? 0
  const completedLapTime = lastLap?.lapTime ?? null
  const disabled = lastLap === null || slug === null || !exportGate.allowed

  const tooltip = (() => {
    if (!exportGate.allowed) return 'Upgrade to Pro to export telemetry'
    if (lastLap === null) return 'Drive a full lap first; export uses the most recently completed lap'
    if (slug === null) return 'No active track selected'
    return `Export ${completedFrames} frames (lap ${(completedLapTime! / 1000).toFixed(2)}s) as ${slug}.demo.json`
  })()

  const handleExport = () => {
    if (!exportGate.allowed || disabled || slug === null || lastLap === null) {
      setState('error')
      return
    }
    try {
      const demo = ghostBuffersToDemo(slug, lastLap.lapTime, lastLap.buffers)
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
    if (!exportGate.allowed) return 'Export demo JSON · Pro'
    if (state === 'exported') return `Exported ${completedFrames} frames`
    if (state === 'error') return 'Export failed'
    if (lastLap === null) return 'Export demo JSON (drive a full lap)'
    return `Export demo JSON (${completedFrames} frames, ${(completedLapTime! / 1000).toFixed(2)}s)`
  })()

  return (
    <Surface
      variant='card'
      className='pointer-events-auto fixed left-4 top-28 z-50 flex flex-col gap-2 p-3 text-xs text-white'
    >
      <button
        type='button'
        onClick={handleExport}
        disabled={disabled}
        title={tooltip}
        className='rounded-full bg-emerald-600 px-3 py-1.5 font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
      >
        {label}
      </button>
      <p className='max-w-[18rem] text-[10px] leading-snug text-neutral-300'>
        Move the downloaded file to{' '}
        <code className='rounded bg-neutral-800 px-1'>
          apps/game/public/demos/{slug ?? '<trackId>'}.demo.json
        </code>{' '}
        before training.
      </p>
    </Surface>
  )
}
