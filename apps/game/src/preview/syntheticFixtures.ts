import type { RuntimePresetTrack } from '@/utils/editorTrackSource'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'
import { RIBBON_MIN_STEP_M } from '@/components/ui/TrackEditor/export/pathToRibbon'

function genSyntheticId(name: string): string {
  return `synthetic_${name.replace(/[^a-z0-9]/g, '_')}`
}

function hairpinArcPoints(radiusM: number): TrackRibbonPoint[] {
  const circumference = Math.PI * radiusM
  const steps = Math.max(4, Math.ceil(circumference / RIBBON_MIN_STEP_M))
  const pts: TrackRibbonPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI
    pts.push({
      x: Math.cos(a) * radiusM,
      y: 0,
      z: Math.sin(a) * radiusM,
      isPitLane: false,
    })
  }
  return pts
}

function sCurvePoints(lengthM: number, amplitudeM: number): TrackRibbonPoint[] {
  const steps = Math.max(8, Math.ceil(lengthM / RIBBON_MIN_STEP_M))
  const pts: TrackRibbonPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    pts.push({
      x: Math.sin(t * Math.PI * 2) * amplitudeM,
      y: 0,
      z: t * lengthM,
      isPitLane: false,
    })
  }
  return pts
}

function uTurnPoints(straight: number, turnRadius: number): TrackRibbonPoint[] {
  const arcCircumference = Math.PI * turnRadius
  const arcSteps = Math.max(4, Math.ceil(arcCircumference / RIBBON_MIN_STEP_M))
  const straightSteps = Math.max(2, Math.ceil(straight / RIBBON_MIN_STEP_M))
  const pts: TrackRibbonPoint[] = []
  for (let i = 0; i <= straightSteps; i++) {
    pts.push({ x: (i / straightSteps) * straight, y: 0, z: 0, isPitLane: false })
  }
  for (let i = 1; i <= arcSteps; i++) {
    const a = (i / arcSteps) * Math.PI
    pts.push({
      x: straight + Math.cos(a) * turnRadius,
      y: 0,
      z: Math.sin(a) * turnRadius,
      isPitLane: false,
    })
  }
  for (let i = 1; i <= straightSteps; i++) {
    pts.push({
      x: straight - (i / straightSteps) * straight,
      y: 0,
      z: turnRadius * 2,
      isPitLane: false,
    })
  }
  return pts
}

function makeRibbon(id: string, points: TrackRibbonPoint[], closed = false): PlacedObject {
  return {
    id,
    type: 'track_ribbon',
    position: [0, 0, 0],
    rotation: 0,
    ribbonPoints: points,
    ribbonClosed: closed,
    width: 12,
  }
}

function makeSyntheticTrack(
  id: string,
  name: string,
  ribbonPoints: TrackRibbonPoint[],
  closed = false,
): RuntimePresetTrack {
  return {
    id,
    name,
    trackLength: 0,
    turns: 0,
    objects: [makeRibbon(`${id}_ribbon`, ribbonPoints, closed)],
  }
}

export const SYNTHETIC_FIXTURES: Record<string, RuntimePresetTrack> = {
  'synthetic:hairpin-4m': makeSyntheticTrack(
    genSyntheticId('hairpin_4m'),
    'Synthetic: 4m Hairpin',
    hairpinArcPoints(4),
  ),
  'synthetic:s-curve-50m': makeSyntheticTrack(
    genSyntheticId('s_curve_50m'),
    'Synthetic: S-Curve (100m long, 20m amplitude)',
    sCurvePoints(100, 20),
  ),
  'synthetic:u-turn-mid': makeSyntheticTrack(
    genSyntheticId('u_turn_mid'),
    'Synthetic: U-Turn (20m straight, 5m radius)',
    uTurnPoints(20, 5),
  ),
}
