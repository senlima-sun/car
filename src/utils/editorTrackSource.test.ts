import { describe, expect, test } from 'bun:test'
import { makeAnchor, makePath } from '@/components/ui/TrackEditor/geometry/path'
import { PAINTED_WIDTH, TRACK_WIDTH } from '@/constants/dimensions'
import { CURB_WIDTH } from '@/constants/curb'
import {
  buildRuntimePresetTrack,
  buildTrackObjectsFromEditorSource,
  type EditorTrackDocument,
} from './editorTrackSource'
import silverstoneSource from '@/constants/tracks/sources/silverstone.json'
import suzukaSource from '@/constants/tracks/sources/suzuka.json'
import monzaSource from '@/constants/tracks/sources/monza.json'

describe('buildTrackObjectsFromEditorSource', () => {
  test('builds runtime objects from editor-native data', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const objects = buildTrackObjectsFromEditorSource({
      paths: [path],
      checkpoints: [{ id: 'sf', kind: 'start-finish', pathId: path.id, segmentIndex: 0, t: 0.5 }],
      raceDirection: 'forward',
      pitBoxAreas: [{ id: 'pb1', position: { x: 20, y: 10 }, rotation: 0 }],
    })

    expect(objects.some(object => object.type === 'track_ribbon')).toBe(true)
    expect(objects.some(object => object.type === 'checkpoint')).toBe(true)
    expect(objects.some(object => object.type === 'pitbox')).toBe(true)
  })
})

describe('curb export sampler', () => {
  test('emits a curb PlacedObject with offset centerline samples', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const objects = buildTrackObjectsFromEditorSource({
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
      curbs: [
        {
          id: 'curb1',
          pathId: path.id,
          pathStart: 0.2,
          pathEnd: 0.8,
          edge: 'left',
          variant: 'apex',
        },
      ],
    })

    const curb = objects.find(o => o.type === 'curb')
    expect(curb).toBeDefined()
    expect(curb!.curbType).toBe('apex')
    expect(curb!.edgeSide).toBe('left')
    expect(curb!.curbCenterline).toBeDefined()
    expect(curb!.curbCenterline!.length).toBeGreaterThanOrEqual(4)

    const first = curb!.curbCenterline![0]!
    expect(first.x).toBeGreaterThan(0)
    expect(first.x).toBeLessThan(100)
    expect(Math.abs(first.z)).toBeCloseTo(TRACK_WIDTH / 2 + CURB_WIDTH / 2)
  })

  test('keeps curb and painted runoff outside the asphalt edge', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const objects = buildTrackObjectsFromEditorSource({
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
      curbs: [
        {
          id: 'curb1',
          pathId: path.id,
          pathStart: 0.2,
          pathEnd: 0.8,
          edge: 'left',
          variant: 'apex',
        },
      ],
    })

    const leftPainted = objects.find(o => o.type === 'painted_area' && o.edgeSide === 'left')
    const curb = objects.find(o => o.type === 'curb' && o.edgeSide === 'left')

    expect(leftPainted).toBeDefined()
    expect(curb).toBeDefined()

    const paintedCenter = leftPainted!.ribbonPoints![0]!
    const paintedInnerEdge = Math.abs(paintedCenter.z) - leftPainted!.width! / 2
    const curbInnerEdge = Math.abs(curb!.curbCenterline![0]!.z) - CURB_WIDTH / 2

    expect(paintedInnerEdge).toBeCloseTo(TRACK_WIDTH / 2 + CURB_WIDTH)
    expect(curbInnerEdge).toBeCloseTo(TRACK_WIDTH / 2)
  })

  test('creates curb-band painted apron only where curb is absent', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const objects = buildTrackObjectsFromEditorSource({
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
      curbs: [
        {
          id: 'curb1',
          pathId: path.id,
          pathStart: 0.2,
          pathEnd: 0.8,
          edge: 'left',
          variant: 'apex',
        },
      ],
    })

    const leftOuterPainted = objects.find(
      o => o.type === 'painted_area' && o.edgeSide === 'left' && o.width === PAINTED_WIDTH,
    )
    const leftAprons = objects.filter(
      o => o.type === 'painted_area' && o.edgeSide === 'left' && o.width === CURB_WIDTH,
    )

    expect(leftOuterPainted).toBeDefined()
    expect(leftAprons.length).toBe(2)

    const apronRanges = leftAprons.map(apron => {
      const xs = apron.ribbonPoints!.map(point => point.x)
      return { min: Math.min(...xs), max: Math.max(...xs) }
    })

    expect(apronRanges.some(range => range.max <= 20.01)).toBe(true)
    expect(apronRanges.some(range => range.min >= 79.99)).toBe(true)
  })

  test('skips zero-length curbs', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const objects = buildTrackObjectsFromEditorSource({
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
      curbs: [
        {
          id: 'tinycurb',
          pathId: path.id,
          pathStart: 0.5,
          pathEnd: 0.5,
          edge: 'right',
          variant: 'flat',
        },
      ],
    })

    expect(objects.some(o => o.type === 'curb')).toBe(false)
  })
})

describe('preset checkpoints stay on the rendered ribbon', () => {
  const presets: Array<[string, EditorTrackDocument]> = [
    ['silverstone', silverstoneSource as unknown as EditorTrackDocument],
    ['suzuka', suzukaSource as unknown as EditorTrackDocument],
    ['monza', monzaSource as unknown as EditorTrackDocument],
  ]

  for (const [name, source] of presets) {
    test(`${name} checkpoints sit within TRACK_WIDTH/4 of the nearest ribbon point`, () => {
      const objects = buildTrackObjectsFromEditorSource(source)
      const ribbons = objects.filter(o => o.type === 'track_ribbon')
      const checkpoints = objects.filter(o => o.type === 'checkpoint')

      expect(ribbons.length).toBeGreaterThan(0)
      expect(checkpoints.length).toBeGreaterThan(0)

      for (const cp of checkpoints) {
        const midX = cp.position[0]
        const midZ = cp.position[2]
        let minDist = Infinity
        for (const ribbon of ribbons) {
          for (const pt of ribbon.ribbonPoints ?? []) {
            const d = Math.hypot(pt.x - midX, pt.z - midZ)
            if (d < minDist) minDist = d
          }
        }
        expect(minDist).toBeLessThanOrEqual(TRACK_WIDTH / 4)
      }
    })
  }
})

describe('buildRuntimePresetTrack', () => {
  test('preserves preset metadata while generating objects', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const preset = buildRuntimePresetTrack({
      id: 'test_track',
      name: 'Test Track',
      trackLength: 100,
      turns: 1,
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
    })

    expect(preset.id).toBe('test_track')
    expect(preset.name).toBe('Test Track')
    expect(preset.trackLength).toBe(100)
    expect(preset.turns).toBe(1)
    expect(preset.objects.length).toBeGreaterThan(0)
  })
})
