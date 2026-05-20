import melbourneSource from './sources/melbourne.json'
import shanghaiSource from './sources/shanghai.json'
import suzukaSource from './sources/suzuka.json'
import miamiSource from './sources/miami.json'
import montrealSource from './sources/montreal.json'
import monacoSource from './sources/monaco.json'
import catalunyaSource from './sources/catalunya.json'
import redBullRingSource from './sources/red-bull-ring.json'
import silverstoneSource from './sources/silverstone.json'
import spaSource from './sources/spa.json'
import hungaroringSource from './sources/hungaroring.json'
import zandvoortSource from './sources/zandvoort.json'
import monzaSource from './sources/monza.json'
import madridSource from './sources/madrid.json'
import bakuSource from './sources/baku.json'
import singaporeSource from './sources/singapore.json'
import cotaSource from './sources/cota.json'
import mexicoCitySource from './sources/mexico-city.json'
import interlagosSource from './sources/interlagos.json'
import lasVegasSource from './sources/las-vegas.json'
import losailSource from './sources/losail.json'
import yasMarinaSource from './sources/yas-marina.json'
import imolaSource from './sources/imola.json'
import {
  buildRuntimePresetTrack,
  type EditorTrackSource,
  type RuntimePresetTrack,
} from '@/utils/editorTrackSource'

export type PresetTrack = RuntimePresetTrack

export const PRESET_TRACK_SOURCES: EditorTrackSource[] = [
  melbourneSource as EditorTrackSource,
  shanghaiSource as EditorTrackSource,
  suzukaSource as EditorTrackSource,
  miamiSource as EditorTrackSource,
  montrealSource as EditorTrackSource,
  monacoSource as EditorTrackSource,
  catalunyaSource as EditorTrackSource,
  redBullRingSource as EditorTrackSource,
  silverstoneSource as EditorTrackSource,
  spaSource as EditorTrackSource,
  hungaroringSource as EditorTrackSource,
  zandvoortSource as EditorTrackSource,
  monzaSource as EditorTrackSource,
  madridSource as EditorTrackSource,
  bakuSource as EditorTrackSource,
  singaporeSource as EditorTrackSource,
  cotaSource as EditorTrackSource,
  mexicoCitySource as EditorTrackSource,
  interlagosSource as EditorTrackSource,
  lasVegasSource as EditorTrackSource,
  losailSource as EditorTrackSource,
  yasMarinaSource as EditorTrackSource,
  imolaSource as EditorTrackSource,
]

export type PresetTrackMeta = Pick<EditorTrackSource, 'id' | 'name' | 'trackLength' | 'turns'>

export const PRESET_TRACK_METAS: ReadonlyArray<PresetTrackMeta> = PRESET_TRACK_SOURCES.map(s => ({
  id: s.id,
  name: s.name,
  trackLength: s.trackLength,
  turns: s.turns,
}))

export function listPresetTracks(): ReadonlyArray<PresetTrackMeta> {
  return PRESET_TRACK_METAS
}

const presetCache = new Map<string, PresetTrack>()

export function getPresetTrack(id: string): PresetTrack | undefined {
  let cached = presetCache.get(id)
  if (!cached) {
    const source = PRESET_TRACK_SOURCES.find(s => s.id === id)
    if (!source) return undefined
    cached = buildRuntimePresetTrack(source)
    presetCache.set(id, cached)
  }
  return structuredClone(cached)
}

export function getPresetTrackSource(id: string): EditorTrackSource | undefined {
  return PRESET_TRACK_SOURCES.find(s => s.id === id)
}
