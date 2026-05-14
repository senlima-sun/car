import type { SavedTrack } from '../types/track'
import { downloadFile } from '../telemetry/exportTelemetry'

interface ExportOptions {
  liveHeightmap?: number[]
}

export function exportTrack(track: SavedTrack, options?: ExportOptions): void {
  const trackData: Record<string, unknown> = {
    name: track.name,
    objects: track.objects,
  }
  const heightmap = options?.liveHeightmap ?? track.heightmap
  if (heightmap && heightmap.length > 0 && heightmap.some(h => h !== 0)) {
    trackData.heightmap = heightmap
  }

  downloadFile(
    JSON.stringify(trackData, null, 2),
    `${track.name.replace(/\s+/g, '_')}.json`,
    'application/json',
  )
}
