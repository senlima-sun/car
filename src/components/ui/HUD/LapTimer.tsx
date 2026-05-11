import { useEffect, useState } from 'react'

import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { usePitStore } from '../../../stores/usePitStore'
import { useGhostCarStore } from '../../../stores/useGhostCarStore'
import { HUD_ACCENT, HUD_DIVIDER_CLASS, HUD_LABEL_CLASS, HUD_STATUS, HudPanel } from './hudChrome'

const TIMER_UPDATE_INTERVAL = 50

function sectorTone(
  sectorNum: number,
  sectorTimes: Map<number, number>,
  bestSectorTimes: Map<number, number>,
): { bar: string; tint: string } {
  const time = sectorTimes.get(sectorNum)
  if (time === undefined) return { bar: 'rgba(255,255,255,0.18)', tint: 'rgba(255,255,255,0.04)' }
  const best = bestSectorTimes.get(sectorNum)
  if (best === time) return { bar: HUD_ACCENT.battery, tint: 'rgba(179,136,255,0.18)' }
  return { bar: '#ffcc00', tint: 'rgba(255,204,0,0.15)' }
}

function formatTime(ms: number | null): string {
  if (ms === null) return '—:——.———'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

function formatSector(ms: number | undefined): string {
  if (ms === undefined) return '—'
  const seconds = ms / 1000
  return seconds.toFixed(3)
}

export default function LapTimer() {
  const isActive = useLapTimeStore(s => s.isActive)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const currentLapStart = useLapTimeStore(s => s.currentLapStart)
  const lastLapTime = useLapTimeStore(s => s.lastLapTime)
  const bestLapTime = useLapTimeStore(s => s.bestLapTime)
  const totalSectors = useLapTimeStore(s => s.totalSectors)
  const sectorTimes = useLapTimeStore(s => s.sectorTimes)
  const bestSectorTimes = useLapTimeStore(s => s.bestSectorTimes)
  const pitPenalty = usePitStore(s => s.pitLaneSpeedingPenalty)
  const ghostTimeDelta = useGhostCarStore(s => s.ghostTimeDelta)
  const [displayLapTime, setDisplayLapTime] = useState(0)

  useEffect(() => {
    if (!isActive || !isRecording || currentLapStart === null) {
      setDisplayLapTime(0)
      return
    }
    let animationId: number
    let lastUpdate = 0
    const update = (now: number) => {
      if (now - lastUpdate >= TIMER_UPDATE_INTERVAL) {
        setDisplayLapTime(now - currentLapStart)
        lastUpdate = now
      }
      animationId = requestAnimationFrame(update)
    }
    animationId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationId)
  }, [isActive, isRecording, currentLapStart])

  if (!isActive || !isRecording) return null

  const hasStarted = currentLapStart !== null
  const ghostAhead = ghostTimeDelta !== null && ghostTimeDelta <= 0
  const ghostColor = ghostAhead ? HUD_STATUS.success : HUD_STATUS.danger

  return (
    <div className='absolute top-[76px] left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none'>
      <HudPanel accent={HUD_ACCENT.speed} contentClassName='px-4 py-2'>
        <div className='flex items-center gap-5'>
          <Column label='Current' accent={HUD_ACCENT.speed}>
            {hasStarted ? (
              <span
                className='font-mono text-[18px] font-semibold leading-none tabular-nums text-white'
                style={{ textShadow: '0 0 14px rgba(0,229,255,0.35)' }}
              >
                {formatTime(displayLapTime)}
              </span>
            ) : (
              <span className='font-sans text-[11px] italic text-white/45'>Cross checkpoint</span>
            )}
          </Column>

          <Divider />

          <Column label='Last'>
            <span className='font-mono text-[14px] tabular-nums text-white/85'>
              {formatTime(lastLapTime)}
            </span>
          </Column>

          <Divider />

          <Column label='Best' accent={HUD_ACCENT.battery}>
            <span
              className='font-mono text-[14px] font-semibold tabular-nums'
              style={{ color: HUD_ACCENT.battery, textShadow: '0 0 12px rgba(179,136,255,0.4)' }}
            >
              {formatTime(bestLapTime)}
            </span>
          </Column>

          {pitPenalty > 0 && (
            <>
              <Divider />
              <Column label='Penalty' accent={HUD_STATUS.danger}>
                <span
                  className='font-mono text-[14px] font-semibold tabular-nums'
                  style={{ color: HUD_STATUS.danger }}
                >
                  +{pitPenalty}s
                </span>
              </Column>
            </>
          )}

          {ghostTimeDelta !== null && (
            <>
              <Divider />
              <Column label='Ghost' accent={ghostColor}>
                <span
                  className='font-mono text-[14px] font-semibold tabular-nums'
                  style={{ color: ghostColor }}
                >
                  {ghostAhead ? '−' : '+'}
                  {Math.abs(ghostTimeDelta / 1000).toFixed(3)}
                </span>
              </Column>
            </>
          )}
        </div>

        {totalSectors > 0 && (
          <div
            className='mt-2 grid gap-1'
            style={{ gridTemplateColumns: `repeat(${totalSectors}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: totalSectors }, (_, i) => {
              const sectorNum = i + 1
              const tone = sectorTone(sectorNum, sectorTimes, bestSectorTimes)
              const time = sectorTimes.get(sectorNum)
              const isEmpty = time === undefined
              return (
                <div
                  key={sectorNum}
                  className='relative overflow-hidden border border-white/8 px-2 py-1'
                  style={{
                    background: isEmpty ? 'rgba(255,255,255,0.03)' : tone.tint,
                    borderLeft: `2px solid ${tone.bar}`,
                    clipPath: 'polygon(4px 0, 100% 0, 100% 100%, 0 100%, 0 4px)',
                  }}
                >
                  <div className='flex items-center justify-between'>
                    <span
                      className='text-[8px] font-bold uppercase tracking-[0.28em]'
                      style={{ color: tone.bar }}
                    >
                      S{sectorNum}
                    </span>
                    <span
                      className='font-mono text-[11px] font-semibold tabular-nums'
                      style={{ color: isEmpty ? 'rgba(255,255,255,0.35)' : '#ffffff' }}
                    >
                      {formatSector(time)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </HudPanel>
    </div>
  )
}

function Column({
  label,
  accent,
  children,
}: {
  label: string
  accent?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col items-start gap-1'>
      <span className={HUD_LABEL_CLASS} style={{ color: accent ?? 'rgba(255,255,255,0.42)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Divider() {
  return <div className={`h-7 ${HUD_DIVIDER_CLASS}`} />
}
