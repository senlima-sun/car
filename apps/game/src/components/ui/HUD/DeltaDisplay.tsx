import { useAiGhostStore } from '@/stores/useAiGhostStore'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useGhostPreferenceStore } from '@/stores/useGhostPreferenceStore'
import { AccentBar, LabelTag, Surface } from '@/components/ui/primitives'
import { HUD_NUMERIC_CLASS, HUD_STATUS } from './hudChrome'

export default function DeltaDisplay() {
  const preferAi = useGhostPreferenceStore(s => s.preferAiGhost)
  const aiReplay = useAiGhostStore(s => s.replayData)
  const aiDelta = useAiGhostStore(s => s.ghostTimeDelta)
  const humanReplay = useGhostCarStore(s => s.replayData)
  const humanDelta = useGhostCarStore(s => s.ghostTimeDelta)
  const humanLoaded = useGhostCarStore(s => s.isLoaded)

  const useAi = preferAi && aiReplay !== null
  const ghostDelta = useAi ? aiDelta : humanDelta
  const replay = useAi ? aiReplay : humanReplay
  const isLoaded = useAi ? aiReplay !== null : humanLoaded

  if (!isLoaded || !replay) return null
  if (ghostDelta === null || Number.isNaN(ghostDelta)) return null

  const delta = ghostDelta
  const isAhead = delta < 0
  const magnitude = Math.abs(delta)
  const accent = isAhead ? HUD_STATUS.success : HUD_STATUS.danger
  const subtle = `${accent}1f`

  return (
    <div className='absolute top-4 right-4 pointer-events-none select-none z-30'>
      <Surface variant='card' className='relative flex items-center gap-3 px-4 py-2 pl-[18px]'>
        <AccentBar color={accent} />
        <div className='flex flex-col items-start'>
          <LabelTag>Ghost Δ</LabelTag>
          <span
            className={`${HUD_NUMERIC_CLASS} text-[22px] leading-none`}
            style={{ color: accent, textShadow: `0 0 18px ${subtle}` }}
          >
            {isAhead ? '−' : '+'}
            {magnitude.toFixed(3)}
            <span className='text-[12px] text-white/55'>s</span>
          </span>
        </div>
        <div
          className='flex h-7 w-7 items-center justify-center rounded-md border border-white/15 text-[12px] font-bold leading-none'
          style={{ color: accent, background: subtle }}
          aria-hidden
        >
          {isAhead ? '▲' : '▼'}
        </div>
      </Surface>
    </div>
  )
}
