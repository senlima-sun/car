import { useGridStore } from '@/stores/useGridStore'
import { LIVERY } from '@/constants/f1Livery'
import { HUD_CLIP_LEFT, HUD_LABEL_CLASS, HudPanel } from './hudChrome'

const TEAM_PALETTE = [
  LIVERY.ACCENT_RED,
  '#00d7f0',
  '#ff8700',
  '#0090ff',
  '#b6babd',
  '#52e252',
  '#3671c6',
  '#229971',
  '#37bedd',
  '#64c4ff',
] as const

function hashToIndex(key: string, mod: number): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % mod
}

function teamColor(teamId: string): string {
  if (!teamId) return TEAM_PALETTE[0]
  return TEAM_PALETTE[hashToIndex(teamId, TEAM_PALETTE.length)]
}

function formatGap(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `+${(ms / 1000).toFixed(3)}`
  return `+${(ms / 1000).toFixed(2)}`
}

function shortName(name: string): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  const last = parts[parts.length - 1]
  return last.slice(0, 3).toUpperCase()
}

export default function TimingTower() {
  const classification = useGridStore(s => s.classification)
  const cars = useGridStore(s => s.cars)

  if (classification.length === 0) return null

  return (
    <div className='absolute left-4 top-[76px] z-20 pointer-events-none select-none'>
      <HudPanel
        accent='#ffcc00'
        clipPath={HUD_CLIP_LEFT}
        className='w-[238px]'
        contentClassName='py-1.5'
        edge='left'
      >
        <div className='flex items-center justify-between border-b border-white/10 px-3 pb-1.5'>
          <span className={HUD_LABEL_CLASS} style={{ color: '#ffcc00' }}>
            Classification
          </span>
          <span className='font-mono text-[10px] tabular-nums text-white/45'>
            {classification.length}
          </span>
        </div>

        <div className='flex flex-col'>
          {classification.map((id, idx) => {
            const car = cars[id]
            if (!car) return null
            const highlight = car.kind === 'player'
            const pos = idx + 1
            const color = teamColor(car.teamId)
            return (
              <div
                key={id}
                className='relative flex items-center gap-2 px-2.5 py-[5px] transition-colors'
                style={{
                  background: highlight ? 'rgba(255,204,0,0.1)' : 'transparent',
                  borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {highlight && <div className='absolute left-0 top-0 h-full w-[2px] bg-[#ffcc00]' />}
                <span
                  className='flex h-5 w-5 shrink-0 items-center justify-center font-mono text-[11px] font-bold tabular-nums text-white'
                  style={{
                    background: color,
                    color: '#0a0a0a',
                    clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)',
                  }}
                >
                  {pos}
                </span>
                <span
                  className='flex-1 truncate font-sans text-[11px] font-semibold uppercase tracking-[0.08em]'
                  style={{ color: highlight ? '#ffe27a' : 'rgba(255,255,255,0.9)' }}
                >
                  {shortName(car.driverName)}
                </span>
                <span
                  className='font-mono text-[11px] tabular-nums'
                  style={{ color: highlight ? '#ffe27a' : 'rgba(255,255,255,0.55)' }}
                >
                  {idx === 0 ? `L${car.currentLap}` : formatGap(car.intervalToAheadMs)}
                </span>
              </div>
            )
          })}
        </div>
      </HudPanel>
    </div>
  )
}
