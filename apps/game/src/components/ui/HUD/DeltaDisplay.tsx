import { useAiGhostStore } from '@/stores/useAiGhostStore'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useGhostPreferenceStore } from '@/stores/useGhostPreferenceStore'
import { HUD_CLIP_LEFT, HUD_LABEL_CLASS, HUD_NUMERIC_CLASS, HUD_STATUS, HudPanel } from './hudChrome'

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
      <HudPanel
        accent={accent}
        clipPath={HUD_CLIP_LEFT}
        contentClassName='flex items-center gap-3 px-4 py-2 pl-[18px]'
        edge='left'
      >
        <div className='flex items-center gap-3'>
          <div className='flex flex-col items-start'>
            <span className={HUD_LABEL_CLASS}>Ghost Δ</span>
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
            className='flex h-7 w-7 items-center justify-center border border-white/15 text-[12px] font-bold leading-none'
            style={{
              color: accent,
              background: subtle,
              clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
            }}
          >
            {isAhead ? '▲' : '▼'}
          </div>
        </div>
      </HudPanel>
    </div>
  )
}
