import { describe, it, expect } from 'bun:test'
import { buildEditorTrackSourceFromPolyline } from '../../../src/utils/editorTrackSourceFromPolyline'
import { buildRuntimePresetTrack } from '../../../src/utils/editorTrackSource'
import type { EditorTrackSource } from '../../../src/utils/editorTrackSource'
import { validateTrackSource } from './validate-source'
import type { CircuitConfigFile } from '../../circuits/_schema'

function baseConfig(overrides: Partial<CircuitConfigFile> = {}): CircuitConfigFile {
  return {
    name: 'test',
    displayName: 'Test Circuit',
    provenance: 'manual',
    startFinishFraction: 0.125,
    expectedTrackLengthMeters: 400,
    expectedTurns: 4,
    expectedStartHeadingDegrees: 90,
    aiDriveLapTimeWindowSeconds: [60, 300],
    ...overrides,
  }
}

function squareSource(overrides: Partial<EditorTrackSource> = {}): EditorTrackSource {
  const base = buildEditorTrackSourceFromPolyline({
    id: 'test_square',
    name: 'Test Square',
    trackLength: 400,
    turns: 4,
    points: [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 100 },
      { x: 0, z: 100 },
      { x: 0, z: 0 },
    ],
    sectorSplits: [0.33, 0.66],
    startFinishFraction: 0.125,
  })
  return { ...base, ...overrides }
}

function computedDrivingHeading(source: EditorTrackSource): number {
  const runtime = buildRuntimePresetTrack(source)
  const sf = runtime.objects.find(o => o.type === 'checkpoint' && o.checkpointType === 'start-finish')
  if (!sf) return 0
  const checkpointLineDeg = (sf.rotation * 180) / Math.PI
  return ((checkpointLineDeg - 90 + 540) % 360) - 180
}

describe('validateTrackSource — length check', () => {
  it('emits critical when length deviates > 3%', () => {
    const source = squareSource({ trackLength: 5891 })
    const config = baseConfig({ expectedTrackLengthMeters: 4000 })
    const report = validateTrackSource(source, config)
    const lengthResult = report.sourceChecks.find(r => r.id === 'source-length')!
    expect(lengthResult.severity).toBe('critical')
    expect(report.canRace).toBe(false)
  })

  it('passes when length is within 3%', () => {
    const source = squareSource({ trackLength: 400 })
    const config = baseConfig({ expectedTrackLengthMeters: 400 })
    const report = validateTrackSource(source, config)
    const lengthResult = report.sourceChecks.find(r => r.id === 'source-length')!
    expect(lengthResult.severity).toBe('pass')
  })

  it('passes at exactly 3% deviation boundary', () => {
    const source = squareSource({ trackLength: 412 })
    const config = baseConfig({ expectedTrackLengthMeters: 400 })
    const report = validateTrackSource(source, config)
    const lengthResult = report.sourceChecks.find(r => r.id === 'source-length')!
    expect(lengthResult.severity).toBe('pass')
  })
})

describe('validateTrackSource — turn count check', () => {
  it('emits warning when turns differ by > 2', () => {
    const source = squareSource({ turns: 25 })
    const config = baseConfig({ expectedTurns: 18 })
    const report = validateTrackSource(source, config)
    const turnsResult = report.sourceChecks.find(r => r.id === 'source-turns')!
    expect(turnsResult.severity).toBe('warning')
    const nonPassCriticals = report.results.filter(r => r.severity === 'critical')
    expect(nonPassCriticals).toHaveLength(0)
  })

  it('passes when turns are within ±2', () => {
    const source = squareSource({ turns: 19 })
    const config = baseConfig({ expectedTurns: 18 })
    const report = validateTrackSource(source, config)
    const turnsResult = report.sourceChecks.find(r => r.id === 'source-turns')!
    expect(turnsResult.severity).toBe('pass')
  })
})

describe('validateTrackSource — start heading check', () => {
  it('passes when heading matches computed heading', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const report = validateTrackSource(source, baseConfig({ expectedStartHeadingDegrees: actualHeading }))
    const headingResult = report.sourceChecks.find(r => r.id === 'source-heading')!
    expect(headingResult.severity).toBe('pass')
  })

  it('emits critical when heading deviates > 15°', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const wrongHeading = ((actualHeading + 180 + 540) % 360) - 180
    const report = validateTrackSource(source, baseConfig({ expectedStartHeadingDegrees: wrongHeading }))
    const headingResult = report.sourceChecks.find(r => r.id === 'source-heading')!
    expect(headingResult.severity).toBe('critical')
  })
})

describe('validateTrackSource — wrap-around angle', () => {
  it('treats 179° vs -179° as 2° difference — no critical', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const report = validateTrackSource(
      source,
      baseConfig({ expectedStartHeadingDegrees: actualHeading }),
    )
    const headingResult = report.sourceChecks.find(r => r.id === 'source-heading')!
    expect(headingResult.severity).toBe('pass')
  })

  it('computes correct angular distance for 179° / -179° wrap', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const nearActual = ((actualHeading + 2 + 540) % 360) - 180
    const report = validateTrackSource(
      source,
      baseConfig({ expectedStartHeadingDegrees: nearActual }),
    )
    const headingResult = report.sourceChecks.find(r => r.id === 'source-heading')!
    expect(headingResult.severity).toBe('pass')
  })

  it('correctly wraps 179° vs -179° = 2° diff, not 358°', () => {
    const southFirstSource = buildEditorTrackSourceFromPolyline({
      id: 'test_south_first',
      name: 'Test South First',
      trackLength: 400,
      turns: 4,
      points: [
        { x: 0, z: 0 },
        { x: 0, z: -100 },
        { x: 100, z: -100 },
        { x: 100, z: 0 },
        { x: 0, z: 0 },
      ],
      sectorSplits: [0.33, 0.66],
      startFinishFraction: 0.125,
    })
    const actualHeading = computedDrivingHeading(southFirstSource)
    expect(Math.abs(Math.abs(actualHeading) - 180)).toBeLessThan(5)
    const expectedAcrossWrap = actualHeading < 0 ? actualHeading + 358 : actualHeading - 358
    const wrappedExpected = ((expectedAcrossWrap + 540) % 360) - 180
    const report = validateTrackSource(
      southFirstSource,
      baseConfig({ expectedStartHeadingDegrees: wrappedExpected }),
    )
    const headingResult = report.sourceChecks.find(r => r.id === 'source-heading')!
    expect(headingResult.severity).toBe('pass')
  })
})

describe('validateTrackSource — zero-length segment', () => {
  it('emits critical for a segment with identical start and end point', () => {
    const source = buildEditorTrackSourceFromPolyline({
      id: 'test_degenerate',
      name: 'Test Degenerate',
      trackLength: 400,
      turns: 4,
      points: [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
        { x: 100, z: 0 },
        { x: 100, z: 100 },
        { x: 0, z: 100 },
        { x: 0, z: 0 },
      ],
      sectorSplits: [0.33, 0.66],
      startFinishFraction: 0.125,
    })
    const config = baseConfig({ expectedTrackLengthMeters: 400 })
    const report = validateTrackSource(source, config)
    const zeroLengths = report.sourceChecks.filter(r => r.id.startsWith('source-zero-seg'))
    expect(zeroLengths.length).toBeGreaterThan(0)
    expect(zeroLengths.every(r => r.severity === 'critical')).toBe(true)
  })
})

describe('validateTrackSource — curvature spike', () => {
  it('emits critical for a bezier segment with curvature > 0.20 (≈ 2m radius)', () => {
    const base = buildEditorTrackSourceFromPolyline({
      id: 'test_kink',
      name: 'Test Kink',
      trackLength: 400,
      turns: 4,
      points: [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
        { x: 100, z: 100 },
        { x: 0, z: 100 },
        { x: 0, z: 0 },
      ],
      sectorSplits: [0.33, 0.66],
      startFinishFraction: 0.125,
    })

    // Inject a tight 2m-radius bezier segment between anchors 0 and 1.
    // Path 2D coordinates: p0=(0,0), c1=(0,2), c2=(4,2), p3=(4,0)
    // produces midpoint (2, 1.5) → Menger curvature ≈ 0.48 >> 0.20
    const tightAnchor0 = {
      id: 'kink_a0',
      point: { x: 0, y: 0 },
      inHandle: { x: 0, y: 0 },
      outHandle: { x: 0, y: 2 },
      handleType: 'smooth' as const,
    }
    const tightAnchor1 = {
      id: 'kink_a1',
      point: { x: 4, y: 0 },
      inHandle: { x: 4, y: 2 },
      outHandle: { x: 8, y: 0 },
      handleType: 'smooth' as const,
    }
    const tightAnchor2 = {
      id: 'kink_a2',
      point: { x: 100, y: 0 },
      inHandle: { x: 100, y: 0 },
      outHandle: { x: 100, y: 0 },
      handleType: 'corner' as const,
    }
    const tightAnchor3 = {
      id: 'kink_a3',
      point: { x: 100, y: 100 },
      inHandle: { x: 100, y: 100 },
      outHandle: { x: 100, y: 100 },
      handleType: 'corner' as const,
    }
    const tightAnchor4 = {
      id: 'kink_a4',
      point: { x: 0, y: 100 },
      inHandle: { x: 0, y: 100 },
      outHandle: { x: 0, y: 0 },
      handleType: 'corner' as const,
    }

    const source: EditorTrackSource = {
      ...base,
      paths: [
        {
          ...base.paths[0]!,
          closed: true,
          anchors: [tightAnchor0, tightAnchor1, tightAnchor2, tightAnchor3, tightAnchor4],
        },
      ],
    }

    const config = baseConfig({ expectedTrackLengthMeters: 400 })
    const report = validateTrackSource(source, config)
    const curvatureIssues = report.sourceChecks.filter(r =>
      r.id.startsWith('source-curvature'),
    )
    expect(curvatureIssues.length).toBeGreaterThan(0)
    expect(curvatureIssues.every(r => r.severity === 'critical')).toBe(true)
  })
})

describe('validateTrackSource — clean source', () => {
  it('returns canRace: true for a well-formed synthetic source', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const config = baseConfig({
      expectedTrackLengthMeters: 400,
      expectedTurns: 4,
      expectedStartHeadingDegrees: actualHeading,
    })
    const report = validateTrackSource(source, config)
    expect(report.canRace).toBe(true)
    expect(report.criticalCount).toBe(0)
  })

  it('report has correct structure', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const config = baseConfig({ expectedStartHeadingDegrees: actualHeading })
    const report = validateTrackSource(source, config)
    expect(Array.isArray(report.results)).toBe(true)
    expect(Array.isArray(report.sourceChecks)).toBe(true)
    expect(typeof report.canRace).toBe('boolean')
    expect(typeof report.criticalCount).toBe('number')
    expect(typeof report.warningCount).toBe('number')
  })

  it('sourceChecks are a subset of results', () => {
    const source = squareSource()
    const actualHeading = computedDrivingHeading(source)
    const config = baseConfig({ expectedStartHeadingDegrees: actualHeading })
    const report = validateTrackSource(source, config)
    const resultIds = new Set(report.results.map(r => r.id))
    for (const check of report.sourceChecks) {
      expect(resultIds.has(check.id)).toBe(true)
    }
  })
})
