import silverstoneSource from './sources/silverstone.json'
import suzukaSource from './sources/suzuka.json'
import monzaSource from './sources/monza.json'
import shanghaiSource from './sources/shanghai.json'
import {
  buildRuntimePresetTrack,
  type EditorTrackSource,
  type RuntimePresetTrack,
} from '@/utils/editorTrackSource'

export type PresetTrack = RuntimePresetTrack

export const PRESET_TRACKS: PresetTrack[] = [
  silverstoneSource as EditorTrackSource,
  suzukaSource as EditorTrackSource,
  monzaSource as EditorTrackSource,
  shanghaiSource as EditorTrackSource,
].map(buildRuntimePresetTrack)

export function getPresetTrack(id: string): PresetTrack | undefined {
  return PRESET_TRACKS.find(t => t.id === id)
}
