import type { PlacedObject } from '../types/trackObjects'
import { isWallType } from '../types/trackObjects'
import type { TrackGraph } from '../types/trackGraph'
import { isCircuit, findConnectedRoads, validateFlowDirections } from './trackGraph'
import { checkOverlap, sampleCenterline, pointOnRoad } from './trackConnection'
import { TRACK_WIDTH } from '../constants/dimensions'

export type ValidationSeverity = 'critical' | 'warning' | 'pass'

export interface ValidationResult {
  id: string
  rule: string
  severity: ValidationSeverity
  message: string
  location?: [number, number, number]
  relatedObjectIds?: string[]
}

export interface TrackValidationReport {
  results: ValidationResult[]
  canRace: boolean
  criticalCount: number
  warningCount: number
}

interface ConnectedComponentResult {
  mainComponentRoadIds: string[]
  orphanRoadIds: string[]
}

const findConnectedComponents = (
  objects: PlacedObject[],
  graph: TrackGraph,
): ConnectedComponentResult => {
  const roads = objects.filter(o => o.type === 'road')
  if (roads.length === 0) return { mainComponentRoadIds: [], orphanRoadIds: [] }

  const visited = new Set<string>()
  const components: string[][] = []

  for (const road of roads) {
    if (visited.has(road.id)) continue

    const component = findConnectedRoads(graph, road.id)
    for (const id of component) visited.add(id)
    components.push(component)
  }

  if (components.length <= 1) {
    return { mainComponentRoadIds: components[0] || [], orphanRoadIds: [] }
  }

  components.sort((a, b) => b.length - a.length)
  const mainComponent = components[0]
  const orphans = components.slice(1).flat()

  return { mainComponentRoadIds: mainComponent, orphanRoadIds: orphans }
}

export interface BarrierOnRoadResult {
  barrierId: string
  position: [number, number, number]
  overlapPercentage: number
}

export function findBarriersOnRoad(
  barriers: PlacedObject[],
  roads: PlacedObject[],
): BarrierOnRoadResult[] {
  const candidateRoads = roads.filter(
    r => r.type === 'road' && r.startPoint && r.endPoint,
  )
  if (candidateRoads.length === 0) return []

  const halfWidth = TRACK_WIDTH / 2
  const results: BarrierOnRoadResult[] = []

  for (const barrier of barriers) {
    if (barrier.type !== 'barrier' && !isWallType(barrier.type)) continue
    if (!barrier.startPoint || !barrier.endPoint) continue

    const samples = sampleCenterline(
      barrier.startPoint,
      barrier.endPoint,
      barrier.controlPoint,
      12,
    )

    let onRoadCount = 0
    for (const sample of samples) {
      for (const road of candidateRoads) {
        if (pointOnRoad(sample.x, sample.z, road, halfWidth)) {
          onRoadCount++
          break
        }
      }
    }

    const overlapPercentage = onRoadCount / samples.length
    if (overlapPercentage > 0.3) {
      results.push({
        barrierId: barrier.id,
        position: barrier.position,
        overlapPercentage,
      })
    }
  }

  return results
}

export const validateTrack = (
  objects: PlacedObject[],
  graph: TrackGraph,
): TrackValidationReport => {
  const results: ValidationResult[] = []

  const startFinish = objects.find(
    o => o.type === 'checkpoint' && (o.checkpointType ?? 'start-finish') === 'start-finish',
  )
  results.push({
    id: 'has-start-finish',
    rule: 'Start/Finish Line',
    severity: startFinish ? 'pass' : 'critical',
    message: startFinish ? 'Start/finish line placed' : 'No start/finish line found',
    location: startFinish?.position,
  })

  const roads = objects.filter(o => o.type === 'road')
  results.push({
    id: 'has-roads',
    rule: 'Track Roads',
    severity: roads.length > 0 ? 'pass' : 'critical',
    message: roads.length > 0 ? `${roads.length} road segments` : 'No road segments placed',
  })

  if (roads.length > 0) {
    const circuitResult = isCircuit(graph)
    results.push({
      id: 'circuit-closed',
      rule: 'Circuit Closure',
      severity: circuitResult.isClosed ? 'pass' : 'critical',
      message: circuitResult.isClosed
        ? 'Circuit is closed'
        : `Open circuit: ${circuitResult.gapLocations.length} gap(s) found`,
      location: circuitResult.gapLocations[0],
      relatedObjectIds: circuitResult.danglingBranches,
    })

    const totalLength = circuitResult.pathLengths.reduce((a, b) => a + b, 0)
    results.push({
      id: 'min-length',
      rule: 'Minimum Track Length',
      severity: totalLength >= 100 ? 'pass' : 'warning',
      message:
        totalLength >= 100
          ? `Track length: ${Math.round(totalLength)} units`
          : `Track too short: ${Math.round(totalLength)} units (min: 100)`,
    })

    const connectedComponents = findConnectedComponents(objects, graph)
    const orphanRoads = connectedComponents.orphanRoadIds
    if (orphanRoads.length > 0) {
      const orphanObj = objects.find(o => o.id === orphanRoads[0])
      results.push({
        id: 'no-orphans',
        rule: 'Road Connectivity',
        severity: 'warning',
        message: `${orphanRoads.length} disconnected road(s) found`,
        location: orphanObj?.position,
        relatedObjectIds: orphanRoads,
      })
    } else {
      results.push({
        id: 'no-orphans',
        rule: 'Road Connectivity',
        severity: 'pass',
        message: 'All roads connected',
      })
    }

    const sectors = objects.filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
    if (sectors.length > 0 && startFinish) {
      results.push({
        id: 'sectors-reachable',
        rule: 'Sector Checkpoints',
        severity: 'pass',
        message: `${sectors.length} sector checkpoint(s) placed`,
      })
    }

    const roadsWithFlow = roads.filter(r => r.flowDirection)
    if (roadsWithFlow.length > 0) {
      const dirValidation = validateFlowDirections(graph, objects)
      const discontinuities = dirValidation.issues.filter(i => i.type === 'discontinuity')
      const isolated = dirValidation.issues.filter(i => i.type === 'isolated')

      if (discontinuities.length > 0) {
        results.push({
          id: 'direction-continuity',
          rule: 'Direction Continuity',
          severity: 'critical',
          message: `${discontinuities.length} direction discontinuit${discontinuities.length === 1 ? 'y' : 'ies'} found`,
          location: discontinuities[0].position,
          relatedObjectIds: discontinuities.map(d => d.roadId),
        })
      } else {
        results.push({
          id: 'direction-continuity',
          rule: 'Direction Continuity',
          severity: 'pass',
          message: 'Flow direction is consistent',
        })
      }

      if (isolated.length > 0) {
        results.push({
          id: 'direction-coverage',
          rule: 'Direction Coverage',
          severity: 'warning',
          message: `${isolated.length} road(s) without direction`,
          location: isolated[0].position,
          relatedObjectIds: isolated.map(d => d.roadId),
        })
      }
    }

    const overlappingPairs: string[] = []
    for (let i = 0; i < roads.length; i++) {
      const road = roads[i]
      if (!road.startPoint || !road.endPoint) continue
      const others = roads.filter((_, j) => j !== i)
      const result = checkOverlap(
        {
          startPoint: road.startPoint,
          endPoint: road.endPoint,
          controlPoint: road.controlPoint,
        },
        others,
      )
      if (result.hasOverlap && result.overlapPercentage > 0.1) {
        const pairKey = [road.id, ...result.affectedRoadIds].sort().join(',')
        if (!overlappingPairs.includes(pairKey)) {
          overlappingPairs.push(pairKey)
        }
      }
    }

    if (overlappingPairs.length > 0) {
      results.push({
        id: 'no-overlap',
        rule: 'Road Overlap',
        severity: 'warning',
        message: `${overlappingPairs.length} overlapping road pair(s) detected`,
      })
    } else {
      results.push({
        id: 'no-overlap',
        rule: 'Road Overlap',
        severity: 'pass',
        message: 'No road overlaps',
      })
    }

    const barriersOnRoad = findBarriersOnRoad(objects, roads)
    if (barriersOnRoad.length > 0) {
      results.push({
        id: 'barriers-on-road',
        rule: 'Barrier Placement',
        severity: 'critical',
        message: `${barriersOnRoad.length} barrier(s) placed on road surface`,
        location: barriersOnRoad[0].position,
        relatedObjectIds: barriersOnRoad.map(b => b.barrierId),
      })
    } else {
      results.push({
        id: 'barriers-on-road',
        rule: 'Barrier Placement',
        severity: 'pass',
        message: 'No barriers on road',
      })
    }
  }

  const criticalCount = results.filter(r => r.severity === 'critical').length
  const warningCount = results.filter(r => r.severity === 'warning').length

  return {
    results,
    canRace: criticalCount === 0,
    criticalCount,
    warningCount,
  }
}
