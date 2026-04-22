import type { PlacedObject } from '@/stores/useCustomizationStore'
import silverstoneData from './silverstone.json'
import suzukaData from './suzuka.json'
import monzaData from './monza.json'
import shanghaiData from './shanghai.json'
import { normalizePresetTrackObjects } from '@/components/ui/TrackEditor/import/trackObjectsToEditor'

export interface PresetTrack {
  id: string
  name: string
  trackLength: number
  turns: number
  objects: PlacedObject[]
}

export function normalizePresetTrack(track: PresetTrack): PresetTrack {
  return {
    ...track,
    objects: normalizePresetTrackObjects(track.objects),
  }
}

export const PRESET_TRACKS: PresetTrack[] = [
  silverstoneData as PresetTrack,
  suzukaData as PresetTrack,
  monzaData as PresetTrack,
  shanghaiData as PresetTrack,
].map(normalizePresetTrack)

export function getPresetTrack(id: string): PresetTrack | undefined {
  return PRESET_TRACKS.find(t => t.id === id)
}
