import type { PlacedObject } from '../types/trackObjects'
import type { TrackGraph } from '../types/trackGraph'
import { isCircuit, findConnectedRoads } from './trackGraph'

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
