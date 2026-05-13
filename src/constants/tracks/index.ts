import silverstoneSource from './sources/silverstone.json'
import suzukaSource from './sources/suzuka.json'
import monzaSource from './sources/monza.json'
import shanghaiSource from './sources/shanghai.json'
import spaSource from './sources/spa.json'
import zandvoortSource from './sources/zandvoort.json'
import redBullRingSource from './sources/red-bull-ring.json'
import hungaroringSource from './sources/hungaroring.json'
import cotaSource from './sources/cota.json'
import interlagosSource from './sources/interlagos.json'
import mexicoCitySource from './sources/mexico-city.json'
import montrealSource from './sources/montreal.json'
import losailSource from './sources/losail.json'
import yasMarinaSource from './sources/yas-marina.json'
import catalunyaSource from './sources/catalunya.json'
import imolaSource from './sources/imola.json'
import monacoSource from './sources/monaco.json'
import singaporeSource from './sources/singapore.json'
import bakuSource from './sources/baku.json'
import miamiSource from './sources/miami.json'
import lasVegasSource from './sources/las-vegas.json'
import melbourneSource from './sources/melbourne.json'
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
  spaSource as EditorTrackSource,
  zandvoortSource as EditorTrackSource,
  redBullRingSource as EditorTrackSource,
  hungaroringSource as EditorTrackSource,
  cotaSource as EditorTrackSource,
  interlagosSource as EditorTrackSource,
  mexicoCitySource as EditorTrackSource,
  montrealSource as EditorTrackSource,
  losailSource as EditorTrackSource,
  yasMarinaSource as EditorTrackSource,
  catalunyaSource as EditorTrackSource,
  imolaSource as EditorTrackSource,
  monacoSource as EditorTrackSource,
  singaporeSource as EditorTrackSource,
  bakuSource as EditorTrackSource,
  miamiSource as EditorTrackSource,
  lasVegasSource as EditorTrackSource,
  melbourneSource as EditorTrackSource,
].map(buildRuntimePresetTrack)

export function getPresetTrack(id: string): PresetTrack | undefined {
  return PRESET_TRACKS.find(t => t.id === id)
}
