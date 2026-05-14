import { useState } from 'react'
import type { TelemetryLap } from '../../../telemetry/TelemetryRingBuffer'
import { downloadCSV, downloadJSON } from '../../../telemetry/exportTelemetry'

interface ExportPanelProps {
  lap: TelemetryLap
}

export default function ExportPanel({ lap }: ExportPanelProps) {
  const [downsample, setDownsample] = useState(1)

  return (
    <div className='flex items-center gap-2 p-2 border-t border-white/10'>
      <span className='text-xs text-white/40'>Export:</span>
      <select
        value={downsample}
        onChange={e => setDownsample(Number(e.target.value))}
        className='bg-white/10 text-white text-xs rounded px-2 py-1 border-0'
      >
        <option value={1}>120 Hz</option>
        <option value={4}>30 Hz</option>
        <option value={12}>10 Hz</option>
      </select>
      <button
        onClick={() => downloadCSV(lap, downsample)}
        className='text-xs px-3 py-1 rounded bg-blue-500/30 text-blue-300 hover:bg-blue-500/50'
      >
        CSV
      </button>
      <button
        onClick={() => downloadJSON(lap, downsample)}
        className='text-xs px-3 py-1 rounded bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
      >
        JSON
      </button>
      <span className='text-xs text-white/30 ml-auto'>
        {lap.frameCount} frames ({(lap.data.byteLength / 1024).toFixed(0)} KB)
      </span>
    </div>
  )
}
