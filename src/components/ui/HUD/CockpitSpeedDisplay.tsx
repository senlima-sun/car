import { useCarStore } from '../../../stores/useCarStore'
import { useGameStore } from '../../../stores/useGameStore'

export default function CockpitSpeedDisplay() {
  const cameraMode = useGameStore(s => s.cameraMode)
  const speed = useCarStore(s => s.speed)

  if (cameraMode === 'first-person') return null

  const displaySpeed = Math.round(Math.abs(speed))

  return (
    <div
      className='absolute bottom-8 left-1/2 -translate-x-1/2 border border-white/10 bg-gradient-to-b from-black/80 to-black/60 px-6 py-3 backdrop-blur-md shadow-[0_12px_28px_rgba(0,0,0,0.5)] pointer-events-none'
      style={{
        clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
      }}
    >
      <div className='flex items-baseline gap-1.5'>
        <span
          className='font-mono text-[44px] font-bold leading-none tabular-nums text-white'
          style={{ textShadow: '0 0 18px rgba(0,229,255,0.25)' }}
        >
          {displaySpeed}
        </span>
        <span className='text-[10px] font-bold uppercase tracking-[0.32em] text-white/55'>
          km/h
        </span>
      </div>
    </div>
  )
}
