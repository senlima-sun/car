import type { EditorTrackSource } from '../../../apps/game/src/utils/editorTrackSource'
import { buildRuntimePresetTrack } from '../../../apps/game/src/utils/editorTrackSource'
import type { CircuitConfigFile } from '../../circuits/_schema'
import type { TrackValidationReport, ValidationResult } from '../../../apps/game/src/utils/trackValidation'
import { computeCurvature } from '../osm-ingest/geometry'

export interface TrackSourceValidationReport extends TrackValidationReport {
  sourceChecks: ValidationResult[]
}

type Vec2 = { x: number; y: number }

function angularDistanceDegrees(a: number, b: number): number {
  let diff = ((a - b + 540) % 360) - 180
  return Math.abs(diff)
}

function bezierMidpoint(p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2): Vec2 {
  const t = 0.5
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
  }
}

function isHandleDistinct(handle: Vec2, point: Vec2): boolean {
  return Math.hypot(handle.x - point.x, handle.y - point.y) > 0.001
}

export function validateTrackSource(
  source: EditorTrackSource,
  config: CircuitConfigFile,
): TrackSourceValidationReport {
  const runtime = buildRuntimePresetTrack(source)
  const objects = runtime.objects

  const baseResults: ValidationResult[] = []

  const ribbon = objects.find(o => o.type === 'track_ribbon')
  const startFinish = objects.find(
    o => o.type === 'checkpoint' && o.checkpointType === 'start-finish',
  )

  baseResults.push({
    id: 'has-start-finish',
    rule: 'Start/Finish Line',
    severity: startFinish ? 'pass' : 'critical',
    message: startFinish ? 'Start/finish line placed' : 'No start/finish line found',
    location: startFinish?.position,
  })

  baseResults.push({
    id: 'has-ribbon',
    rule: 'Track Ribbon',
    severity: ribbon ? 'pass' : 'critical',
    message: ribbon ? 'Track ribbon generated' : 'No track ribbon — path has fewer than 2 anchors',
  })

  if (ribbon) {
    const pts = ribbon.ribbonPoints ?? []
    const isClosed = ribbon.ribbonClosed === true
    let closureGap = Infinity
    if (!isClosed && pts.length >= 2) {
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      closureGap = Math.hypot(first.x - last.x, first.z - last.z)
    }
    const circuitClosed = isClosed || closureGap <= 5
    baseResults.push({
      id: 'circuit-closed',
      rule: 'Circuit Closure',
      severity: circuitClosed ? 'pass' : 'critical',
      message: circuitClosed
        ? 'Circuit is closed'
        : `Open circuit: ribbon endpoints ${Math.round(closureGap)}m apart`,
    })
  }

  const sourceChecks: ValidationResult[] = []

  const lengthDeviation =
    Math.abs(source.trackLength - config.expectedTrackLengthMeters) /
    config.expectedTrackLengthMeters
  sourceChecks.push({
    id: 'source-length',
    rule: 'Track Length',
    severity: lengthDeviation > 0.03 ? 'critical' : 'pass',
    message:
      lengthDeviation > 0.03
        ? `Length ${source.trackLength}m deviates ${(lengthDeviation * 100).toFixed(1)}% from expected ${config.expectedTrackLengthMeters}m (max 3%)`
        : `Length ${source.trackLength}m within 3% of expected ${config.expectedTrackLengthMeters}m`,
  })

  const turnDiff = Math.abs(source.turns - config.expectedTurns)
  sourceChecks.push({
    id: 'source-turns',
    rule: 'Turn Count',
    severity: turnDiff > 2 ? 'warning' : 'pass',
    message:
      turnDiff > 2
        ? `Turn count ${source.turns} differs from expected ${config.expectedTurns} by ${turnDiff} (max ±2)`
        : `Turn count ${source.turns} within ±2 of expected ${config.expectedTurns}`,
  })

  if (startFinish) {
    const checkpointLineDegrees = (startFinish.rotation * 180) / Math.PI
    const drivingHeadingDegrees = ((checkpointLineDegrees - 90 + 540) % 360) - 180
    const headingDiff = angularDistanceDegrees(drivingHeadingDegrees, config.expectedStartHeadingDegrees)
    sourceChecks.push({
      id: 'source-heading',
      rule: 'Start Heading',
      severity: headingDiff > 15 ? 'critical' : 'pass',
      message:
        headingDiff > 15
          ? `Start heading ${drivingHeadingDegrees.toFixed(1)}° deviates ${headingDiff.toFixed(1)}° from expected ${config.expectedStartHeadingDegrees}° (max 15°)`
          : `Start heading ${drivingHeadingDegrees.toFixed(1)}° within 15° of expected ${config.expectedStartHeadingDegrees}°`,
    })
  } else {
    sourceChecks.push({
      id: 'source-heading',
      rule: 'Start Heading',
      severity: 'critical',
      message: 'Cannot check start heading: no start/finish checkpoint found',
    })
  }

  for (const path of source.paths) {
    const anchors = path.anchors
    if (!anchors || anchors.length < 2) continue

    for (let i = 0; i < anchors.length - 1; i++) {
      const fromAnchor = anchors[i]!
      const toAnchor = anchors[i + 1]!
      const p0: Vec2 = fromAnchor.point
      const p3: Vec2 = toAnchor.point

      const segLen = Math.hypot(p3.x - p0.x, p3.y - p0.y)
      if (segLen < 1) {
        sourceChecks.push({
          id: `source-zero-seg-${path.id}-${i}`,
          rule: 'Zero-Length Segment',
          severity: 'critical',
          message: `Path ${path.id} segment ${i}: endpoint distance ${segLen.toFixed(2)}m < 1m`,
          location: [p0.x, 0, p0.y],
        })
      }

      const c1: Vec2 = isHandleDistinct(fromAnchor.outHandle, p0) ? fromAnchor.outHandle : p0
      const c2: Vec2 = isHandleDistinct(toAnchor.inHandle, p3) ? toAnchor.inHandle : p3
      const isCurve = isHandleDistinct(c1, p0) || isHandleDistinct(c2, p3)

      if (isCurve) {
        const mid = bezierMidpoint(p0, c1, c2, p3)
        const curvature = computeCurvature(
          { x: p0.x, z: p0.y },
          { x: mid.x, z: mid.y },
          { x: p3.x, z: p3.y },
        )
        if (curvature > 0.2) {
          sourceChecks.push({
            id: `source-curvature-${path.id}-${i}`,
            rule: 'Curvature Spike',
            severity: 'critical',
            message: `Path ${path.id} segment ${i}: Menger curvature ${curvature.toFixed(3)} exceeds 0.20 (radius < 5m)`,
            location: [mid.x, 0, mid.y],
          })
        }
      }
    }
  }

  const allResults = [...baseResults, ...sourceChecks]
  const criticalCount = allResults.filter(r => r.severity === 'critical').length
  const warningCount = allResults.filter(r => r.severity === 'warning').length

  return {
    results: allResults,
    sourceChecks,
    canRace: criticalCount === 0,
    criticalCount,
    warningCount,
  }
}
