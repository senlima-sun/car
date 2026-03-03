import { useState, useCallback } from 'react'
import { useTelemetryStore } from '../../../stores/useTelemetryStore'
import type { ChannelId } from '../../../telemetry/channels'
import LapSelector from './LapSelector'
import ChannelSelector, { DEFAULT_CHANNELS } from './ChannelSelector'
import StripChart from './StripChart'
import LapComparison from './LapComparison'
import ExportPanel from './ExportPanel'

export default function TelemetryAnalysis() {
  const analysisOpen = useTelemetryStore(s => s.analysisOpen)
  const completedLaps = useTelemetryStore(s => s.completedLaps)
  const selectedLapIndex = useTelemetryStore(s => s.selectedLapIndex)
  const comparisonLapIndex = useTelemetryStore(s => s.comparisonLapIndex)
  const setSelectedLap = useTelemetryStore(s => s.setSelectedLap)
  const setComparisonLap = useTelemetryStore(s => s.setComparisonLap)
  const setAnalysisOpen = useTelemetryStore(s => s.setAnalysisOpen)

  const [channels, setChannels] = useState<ChannelId[]>(DEFAULT_CHANNELS)
  const [showChannelPicker, setShowChannelPicker] = useState(false)

  const handleClose = useCallback(() => setAnalysisOpen(false), [setAnalysisOpen])

  if (!analysisOpen) return null

  const selectedLap = selectedLapIndex !== null ? completedLaps[selectedLapIndex] : null
  const comparisonLap =
    comparisonLapIndex !== null ? completedLaps[comparisonLapIndex] : null

  return (
    <div className='absolute inset-0 bg-black/90 z-[100] flex flex-col pointer-events-auto'>
      <div className='flex items-center justify-between px-4 py-2 border-b border-white/10'>
        <h2 className='text-white text-sm font-bold tracking-wider'>TELEMETRY ANALYSIS</h2>
        <div className='flex gap-2'>
          <button
            onClick={() => setShowChannelPicker(!showChannelPicker)}
            className='text-xs px-3 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20'
          >
            Channels
          </button>
          <button
            onClick={handleClose}
            className='text-xs px-3 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20'
          >
            Close (F4)
          </button>
        </div>
      </div>

      {showChannelPicker && (
        <div className='border-b border-white/10'>
          <ChannelSelector selected={channels} onChange={setChannels} />
        </div>
      )}

      <div className='flex flex-1 overflow-hidden'>
        <div className='w-64 border-r border-white/10 overflow-y-auto'>
          <div className='text-white/40 text-xs px-3 py-2 border-b border-white/5'>
            LAPS ({completedLaps.length})
          </div>
          <LapSelector
            laps={completedLaps}
            selectedIndex={selectedLapIndex}
            comparisonIndex={comparisonLapIndex}
            onSelect={setSelectedLap}
            onCompare={setComparisonLap}
          />
        </div>

        <div className='flex-1 overflow-hidden flex flex-col'>
          {selectedLap ? (
            <>
              <div className='flex-1 overflow-hidden p-2'>
                <StripChart
                  lap={selectedLap}
                  comparisonLap={comparisonLap}
                  channels={channels}
                  width={Math.max(600, window.innerWidth - 300)}
                  height={
                    comparisonLap
                      ? Math.max(300, window.innerHeight - 320)
                      : Math.max(400, window.innerHeight - 200)
                  }
                />
              </div>
              {selectedLap && comparisonLap && (
                <div className='px-2 pb-2'>
                  <LapComparison
                    baseLap={selectedLap}
                    comparisonLap={comparisonLap}
                    width={Math.max(600, window.innerWidth - 300)}
                  />
                </div>
              )}
              <ExportPanel lap={selectedLap} />
            </>
          ) : (
            <div className='flex items-center justify-center h-full text-white/30 text-sm'>
              Select a lap to view telemetry
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
