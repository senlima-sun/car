import { useEffect, useState } from 'react'

import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { usePitStore } from '../../../stores/usePitStore'
import { useGhostCarStore } from '../../../stores/useGhostCarStore'

const GHOST_POLL_INTERVAL = 100

function getSectorBg(
  sectorNum: number,
  sectorTimes: Map<number, number>,
  bestSectorTimes: Map<number, number>,
): string {
  const time = sectorTimes.get(sectorNum)
  if (time === undefined) return 'transparent'
  const best = bestSectorTimes.get(sectorNum)
  if (best === time) return '#a855f7'
  return '#eab308'
}

function formatTime(ms: number | null): string {
  if (ms === null) return '--:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

const LABEL = 'text-[10px] text-[#888] uppercase tracking-wide mb-0.5'

export default function LapTimer() {
  const isActive = useLapTimeStore(state => state.isActive)
  const isRecording = useLapTimeStore(state => state.isRecording)
  const currentLapStart = useLapTimeStore(state => state.currentLapStart)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)
  const lastLapTime = useLapTimeStore(state => state.lastLapTime)
  const bestLapTime = useLapTimeStore(state => state.bestLapTime)
  const lapCount = useLapTimeStore(state => state.lapCount)
  const updateCurrentTime = useLapTimeStore(state => state.updateCurrentTime)
  const totalSectors = useLapTimeStore(state => state.totalSectors)
  const sectorTimes = useLapTimeStore(state => state.sectorTimes)
  const bestSectorTimes = useLapTimeStore(state => state.bestSectorTimes)
  const pitPenalty = usePitStore(state => state.pitLaneSpeedingPenalty)
  const [ghostTimeDelta, setGhostDelta] = useState<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setGhostDelta(useGhostCarStore.getState().ghostTimeDelta)
    }, GHOST_POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!isActive || !isRecording || currentLapStart === null) return

    let animationId: number
    const update = () => {
      updateCurrentTime()
      animationId = requestAnimationFrame(update)
    }
    animationId = requestAnimationFrame(update)

    return () => cancelAnimationFrame(animationId)
  }, [isActive, isRecording, currentLapStart, updateCurrentTime])

  if (!isActive || !isRecording) return null

  const hasStarted = currentLapStart !== null

  return (
    <div className='absolute top-0 left-1/2 -translate-x-1/2 rounded-b bg-black/70 p-2'>
      <div className='flex gap-6'>
        <div className='text-center'>
          <div className={LABEL}>Current</div>
          {hasStarted ? (
            <div className='font-bold font-mono text-[#00ff88] [text-shadow:0_0_10px_rgba(0,255,136,0.5)]'>
              {formatTime(currentLapTime)}
            </div>
          ) : (
            <div className='text-xs italic text-[#666]'>Cross checkpoint</div>
          )}
        </div>

        <div className='text-center'>
          <div className={LABEL}>Last</div>
          <div className='text-base font-mono text-white'>{formatTime(lastLapTime)}</div>
        </div>

        <div className='text-center'>
          <div className={LABEL}>Best</div>
          <div className='text-base font-mono text-[#ff00ff] [text-shadow:0_0_8px_rgba(255,0,255,0.5)]'>
            {formatTime(bestLapTime)}
          </div>
        </div>

        <div className='text-center'>
          <div className={LABEL}>Lap</div>
          <div className='text-sm font-mono text-[#aaa]'>{lapCount}</div>
        </div>

        <div className='text-center'>
          <div className={`${LABEL} text-red-500!`}>Penalty</div>
          {pitPenalty > 0 && (
            <div className='text-sm font-bold font-mono text-red-500'>+{pitPenalty}s</div>
          )}
        </div>

        {ghostTimeDelta !== null && (
          <div className='text-center'>
            <div className={LABEL}>Gap</div>
            <div
              className='text-base font-bold font-mono'
              style={{
                color: ghostTimeDelta <= 0 ? '#00ff88' : '#ff4444',
                textShadow: `0 0 8px ${ghostTimeDelta <= 0 ? 'rgba(0,255,136,0.5)' : 'rgba(255,68,68,0.5)'}`,
              }}
            >
              {ghostTimeDelta <= 0 ? '-' : '+'}
              {Math.abs(ghostTimeDelta / 1000).toFixed(3)}s
            </div>
          </div>
        )}
      </div>

      {totalSectors > 0 && (
        <div className='flex gap-1 mt-1'>
          {Array.from({ length: totalSectors }, (_, i) => {
            const sectorNum = i + 1
            const bg = getSectorBg(sectorNum, sectorTimes, bestSectorTimes)
            const time = sectorTimes.get(sectorNum)
            const isEmpty = time === undefined
            return (
              <div
                key={sectorNum}
                className={`flex-1 py-1 text-center rounded-sm ${
                  isEmpty ? 'border border-white/30' : ''
                }`}
                style={isEmpty ? undefined : { backgroundColor: bg }}
              >
                <div className='text-[9px] text-white/70 leading-none'>S{sectorNum}</div>
                {time !== undefined && (
                  <div className='text-[11px] font-mono text-white font-semibold leading-tight'>
                    {formatTime(time)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
