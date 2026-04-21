import { TELEMETRY_STRIDE, CHANNEL_META } from './channels'
import type { ChannelId } from './channels'
import type { TelemetryLap } from './TelemetryRingBuffer'

const ALL_CHANNELS = Object.keys(CHANNEL_META).map(Number) as ChannelId[]

export function exportCSV(lap: TelemetryLap, downsampleFactor = 1): string {
  const headers = ALL_CHANNELS.map(ch => CHANNEL_META[ch].name)
  const lines = [headers.join(',')]

  for (let i = 0; i < lap.frameCount; i += downsampleFactor) {
    const offset = i * TELEMETRY_STRIDE
    const values = ALL_CHANNELS.map(ch => {
      const v = lap.data[offset + ch]
      return Number.isFinite(v) ? v.toFixed(4) : '0'
    })
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

export function exportJSON(lap: TelemetryLap, downsampleFactor = 1): string {
  const channelDefs = ALL_CHANNELS.map(ch => ({
    offset: ch,
    ...CHANNEL_META[ch],
  }))

  const frames: number[][] = []
  for (let i = 0; i < lap.frameCount; i += downsampleFactor) {
    const offset = i * TELEMETRY_STRIDE
    const row = ALL_CHANNELS.map(ch => {
      const v = lap.data[offset + ch]
      return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0
    })
    frames.push(row)
  }

  return JSON.stringify(
    {
      version: 1,
      trackId: lap.trackId,
      lapTime: lap.lapTime,
      timestamp: lap.timestamp,
      sampleRate: 120 / downsampleFactor,
      frameCount: frames.length,
      channels: channelDefs,
      data: frames,
    },
    null,
    2,
  )
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCSV(lap: TelemetryLap, downsample = 1) {
  const csv = exportCSV(lap, downsample)
  const time = formatLapTimeFile(lap.lapTime)
  downloadFile(csv, `telemetry_${lap.trackId}_${time}.csv`, 'text/csv')
}

export function downloadJSON(lap: TelemetryLap, downsample = 1) {
  const json = exportJSON(lap, downsample)
  const time = formatLapTimeFile(lap.lapTime)
  downloadFile(json, `telemetry_${lap.trackId}_${time}.json`, 'application/json')
}

function formatLapTimeFile(ms: number): string {
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  const millis = Math.floor(ms % 1000)
  return `${mins}m${secs}s${millis}ms`
}
