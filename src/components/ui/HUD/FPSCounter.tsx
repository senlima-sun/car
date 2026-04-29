import { useFPSStore, FPS_HISTORY_SIZE } from '@/stores/useFPSStore'
import { useGameStore } from '@/stores/useGameStore'
import { HUD_CLIP_LEFT, HUD_LABEL_CLASS, HudPanel } from './hudChrome'

const GRAPH_W = 120
const GRAPH_H = 28
const GRAPH_MAX_FPS = 130

function fpsTone(fps: number): string {
  if (fps >= 55) return '#22c55e'
  if (fps >= 30) return '#ffcc00'
  return '#ef4444'
}

function buildPath(history: number[]): string {
  if (history.length === 0) return ''
  const stepX = GRAPH_W / (FPS_HISTORY_SIZE - 1)
  let d = ''
  for (let i = 0; i < history.length; i++) {
    const v = Math.min(GRAPH_MAX_FPS, Math.max(0, history[i]))
    const x = i * stepX
    const y = GRAPH_H - (v / GRAPH_MAX_FPS) * GRAPH_H
    d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`
  }
  return d
}

function buildAreaPath(linePath: string): string {
  if (!linePath) return ''
  return `${linePath} L${GRAPH_W},${GRAPH_H} L0,${GRAPH_H} Z`
}

function gridY(fps: number): number {
  return GRAPH_H - (fps / GRAPH_MAX_FPS) * GRAPH_H
}

export default function FPSCounter() {
  const fps = useFPSStore(state => state.fps)
  const history = useFPSStore(state => state.history)
  const showFPS = useGameStore(state => state.showFPS)

  if (!showFPS) return null

  const color = fpsTone(fps)
  const minFps = history.reduce((m, v) => Math.min(m, v), Infinity)
  const maxFps = history.reduce((m, v) => Math.max(m, v), 0)
  const linePath = buildPath(history)
  const areaPath = buildAreaPath(linePath)

  return (
    <div className='absolute top-4 left-4 pointer-events-none z-[900]'>
      <HudPanel
        accent={color}
        clipPath={HUD_CLIP_LEFT}
        contentClassName='flex items-center gap-2.5 px-2.5 py-1'
        edge='left'
      >
        <span
          className='h-1.5 w-1.5 rounded-full'
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
        <span className='font-mono text-[11px] font-semibold tabular-nums text-white'>{fps}</span>
        <span className={HUD_LABEL_CLASS}>fps</span>

        <svg
          width={GRAPH_W}
          height={GRAPH_H}
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          className='ml-1'
          aria-hidden='true'
        >
          <line
            x1={0}
            x2={GRAPH_W}
            y1={gridY(120)}
            y2={gridY(120)}
            stroke='rgba(255,255,255,0.12)'
            strokeDasharray='2 3'
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={GRAPH_W}
            y1={gridY(60)}
            y2={gridY(60)}
            stroke='rgba(255,255,255,0.08)'
            strokeDasharray='2 3'
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={GRAPH_W}
            y1={gridY(30)}
            y2={gridY(30)}
            stroke='rgba(239,68,68,0.18)'
            strokeDasharray='2 3'
            strokeWidth={1}
          />
          {areaPath && <path d={areaPath} fill={color} fillOpacity={0.14} />}
          {linePath && (
            <path d={linePath} fill='none' stroke={color} strokeWidth={1.25} strokeLinejoin='round' />
          )}
        </svg>

        <div className='flex flex-col items-end leading-none'>
          <span className='font-mono text-[8px] tabular-nums text-white/55'>
            <span className='text-white/35'>hi </span>
            {maxFps}
          </span>
          <span className='font-mono text-[8px] tabular-nums text-white/55 mt-0.5'>
            <span className='text-white/35'>lo </span>
            {minFps === Infinity ? 0 : minFps}
          </span>
        </div>
      </HudPanel>
    </div>
  )
}
