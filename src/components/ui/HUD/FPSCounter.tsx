import { useFPSStore } from '@/stores/useFPSStore'
import { useGameStore } from '@/stores/useGameStore'

function fpsTone(fps: number): string {
  if (fps >= 55) return '#22c55e'
  if (fps >= 30) return '#ffcc00'
  return '#ef4444'
}

export default function FPSCounter() {
  const fps = useFPSStore(state => state.fps)
  const showFPS = useGameStore(state => state.showFPS)

  if (!showFPS) return null

  const color = fpsTone(fps)

  return (
    <div className='absolute top-3 right-[210px] pointer-events-none z-[900]'>
      <div
        className='flex items-center gap-2 border border-white/10 bg-black/70 px-2.5 py-1 backdrop-blur-md'
        style={{
          clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
        }}
      >
        <span className='h-1.5 w-1.5 rounded-full' style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className='font-mono text-[11px] font-semibold tabular-nums text-white'>{fps}</span>
        <span className='text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>fps</span>
      </div>
    </div>
  )
}
