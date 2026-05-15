import { useState } from 'react'
import { useAiGhostStore } from '@/stores/useAiGhostStore'
import { useGhostPreferenceStore } from '@/stores/useGhostPreferenceStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { type AiGhostSidecar, decodeGhostBin } from '@/utils/aiGhostDecoder'
import { CURRENT_GHOST_SCHEMA_VERSION } from '@/utils/ghostReplayDB'

type LoadState = 'idle' | 'loading' | 'loaded' | 'missing' | 'error'

function resolveTrackSlug(): string | null {
  const trackState = useTrackStore.getState()
  const active = trackState.getActiveTrack()
  if (active?.presetId) return active.presetId
  const activeId = trackState.trackLibrary.activeTrackId
  return activeId ?? null
}

export function LoadAiGhostButton() {
  const [state, setState] = useState<LoadState>('idle')
  const aiReplay = useAiGhostStore(s => s.replayData)
  const preferAiGhost = useGhostPreferenceStore(s => s.preferAiGhost)
  const spectatorMode = useGhostPreferenceStore(s => s.spectatorMode)
  const togglePrefer = useGhostPreferenceStore(s => s.toggle)
  const setSpectatorMode = useGhostPreferenceStore(s => s.setSpectatorMode)

  const handleLoad = async () => {
    const slug = resolveTrackSlug()
    if (!slug) {
      setState('missing')
      return
    }
    setState('loading')
    try {
      const metaRes = await fetch(`/ai-replays/${slug}.ghost.json`)
      if (!metaRes.ok) {
        console.warn('[ai-ghost] no metadata for', slug)
        setState('missing')
        return
      }
      const meta = (await metaRes.json()) as AiGhostSidecar
      if (typeof meta.schemaVersion !== 'number') {
        console.warn('[ai-ghost] sidecar missing schemaVersion for', slug)
        setState('error')
        return
      }
      if (meta.schemaVersion > CURRENT_GHOST_SCHEMA_VERSION) {
        console.warn(
          '[ai-ghost] unsupported schemaVersion:',
          meta.schemaVersion,
          'current:',
          CURRENT_GHOST_SCHEMA_VERSION,
        )
        setState('error')
        return
      }
      const binRes = await fetch(`/ai-replays/${slug}.ghost.bin`)
      if (!binRes.ok) {
        console.warn('[ai-ghost] no binary for', slug)
        setState('missing')
        return
      }
      const buf = await binRes.arrayBuffer()
      const decoded = decodeGhostBin(buf, meta)
      useAiGhostStore.getState().setReplay(decoded)
      useGhostPreferenceStore.getState().setPreferAiGhost(true)
      setState('loaded')
    } catch (err) {
      console.warn('[ai-ghost] load failed', err)
      setState('error')
    }
  }

  const handleClear = () => {
    useGhostPreferenceStore.getState().setSpectatorMode(false)
    useAiGhostStore.getState().clearReplay()
    useGhostPreferenceStore.getState().setPreferAiGhost(false)
    setState('idle')
  }

  const handleToggleSpectator = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSpectatorMode(event.target.checked)
  }

  const label = (() => {
    switch (state) {
      case 'loading':
        return 'Loading AI ghost…'
      case 'loaded':
        return 'AI ghost loaded'
      case 'missing':
        return 'AI ghost not found'
      case 'error':
        return 'AI ghost load failed'
      default:
        return 'Load AI Ghost'
    }
  })()

  return (
    <div className="pointer-events-auto fixed left-4 top-4 z-50 flex flex-col gap-2 rounded-md bg-black/70 p-3 text-xs text-white shadow-lg">
      <button
        type="button"
        onClick={handleLoad}
        disabled={state === 'loading'}
        className="rounded bg-blue-600 px-3 py-1.5 font-medium hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
      {aiReplay !== null && (
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferAiGhost}
              onChange={togglePrefer}
              disabled={spectatorMode}
              className="h-3 w-3"
            />
            <span>Prefer AI ghost</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={spectatorMode}
              onChange={handleToggleSpectator}
              className="h-3 w-3"
            />
            <span>Watch (spectator)</span>
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="rounded bg-neutral-700 px-3 py-1 hover:bg-neutral-600"
          >
            Clear
          </button>
        </>
      )}
    </div>
  )
}
