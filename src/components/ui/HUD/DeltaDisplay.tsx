import { useGhostCarStore } from '@/stores/useGhostCarStore'

export default function DeltaDisplay() {
  const ghostDelta = useGhostCarStore(s => s.ghostTimeDelta)
  const isLoaded = useGhostCarStore(s => s.isLoaded)
  const replay = useGhostCarStore(s => s.replayData)

  if (!isLoaded || !replay) return null
  if (ghostDelta === null || Number.isNaN(ghostDelta)) return null

  const delta = ghostDelta
  const isAhead = delta < 0
  const magnitude = Math.abs(delta)

  return (
    <div className='absolute top-[22%] left-1/2 -translate-x-1/2 pointer-events-none select-none'>
      <div
        className='rounded-lg border px-4 py-2 text-center font-mono text-2xl font-semibold shadow-lg backdrop-blur-sm'
        style={{
          borderColor: isAhead ? 'rgba(120, 220, 130, 0.55)' : 'rgba(230, 90, 90, 0.55)',
          background: isAhead ? 'rgba(20, 70, 30, 0.7)' : 'rgba(70, 20, 20, 0.7)',
          color: isAhead ? '#7ce08a' : '#ff8787',
        }}
      >
        {isAhead ? '−' : '+'}
        {magnitude.toFixed(3)}s
      </div>
    </div>
  )
}
