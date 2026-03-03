import type { TelemetryLap } from '../../../telemetry/TelemetryRingBuffer'

interface LapSelectorProps {
  laps: TelemetryLap[]
  selectedIndex: number | null
  comparisonIndex: number | null
  onSelect: (index: number) => void
  onCompare: (index: number | null) => void
}

function formatTime(ms: number): string {
  const mins = Math.floor(ms / 60000)
  const secs = ((ms % 60000) / 1000).toFixed(3)
  return `${mins}:${secs.padStart(6, '0')}`
}

export default function LapSelector({
  laps,
  selectedIndex,
  comparisonIndex,
  onSelect,
  onCompare,
}: LapSelectorProps) {
  if (laps.length === 0) {
    return (
      <div className='text-white/40 text-sm p-4 text-center'>
        No laps recorded yet. Complete a lap to see data.
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-1 p-2 max-h-[200px] overflow-y-auto'>
      {laps.map((lap, i) => {
        const isSelected = selectedIndex === i
        const isComparison = comparisonIndex === i
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer transition-colors ${
              isSelected
                ? 'bg-blue-500/30 text-white'
                : isComparison
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
            onClick={() => onSelect(i)}
          >
            <span className='font-mono text-xs text-white/40'>#{i + 1}</span>
            <span className='font-mono flex-1'>{formatTime(lap.lapTime)}</span>
            <span className='text-xs text-white/30'>{lap.frameCount}f</span>
            {selectedIndex !== null && selectedIndex !== i && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  onCompare(isComparison ? null : i)
                }}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  isComparison
                    ? 'bg-orange-500/40 text-orange-200'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                }`}
              >
                {isComparison ? 'CMP' : 'vs'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
