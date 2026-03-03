import { useFPSStore } from '@/stores/useFPSStore'
import { useGameStore } from '@/stores/useGameStore'

export default function FPSCounter() {
  const fps = useFPSStore(state => state.fps)
  const showFPS = useGameStore(state => state.showFPS)

  if (!showFPS) return null

  return (
    <div className='absolute top-2 left-2 pointer-events-none z-[1000]'>
      <div className='bg-black/50 text-white/80 px-2 py-1 rounded text-xs font-mono backdrop-blur-sm border border-white/10'>
        {fps} FPS
      </div>
    </div>
  )
}
