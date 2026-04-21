import { useMemo } from 'react'
import type { TelemetryLap } from '../../../telemetry/TelemetryRingBuffer'
import { computeLapDelta } from '../../../telemetry/lapComparison'
import DeltaChart from './DeltaChart'

interface LapComparisonProps {
  baseLap: TelemetryLap
  comparisonLap: TelemetryLap
  width: number
}

function formatTime(ms: number): string {
  const mins = Math.floor(ms / 60000)
  const secs = ((ms % 60000) / 1000).toFixed(3)
  return `${mins}:${secs.padStart(6, '0')}`
}

export default function LapComparison({ baseLap, comparisonLap, width }: LapComparisonProps) {
  const delta = useMemo(
    () =>
      computeLapDelta(
        baseLap.data,
        baseLap.frameCount,
        comparisonLap.data,
        comparisonLap.frameCount,
      ),
    [baseLap, comparisonLap],
  )

  const timeDiff = baseLap.lapTime - comparisonLap.lapTime
  const sign = timeDiff >= 0 ? '+' : ''

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-4 px-2 text-xs'>
        <span className='text-blue-400'>Base: {formatTime(baseLap.lapTime)}</span>
        <span className='text-orange-400'>Compare: {formatTime(comparisonLap.lapTime)}</span>
        <span className={timeDiff < 0 ? 'text-green-400' : 'text-red-400'}>
          {sign}
          {(timeDiff / 1000).toFixed(3)}s
        </span>
      </div>
      <DeltaChart delta={delta} width={width} height={120} />
    </div>
  )
}
