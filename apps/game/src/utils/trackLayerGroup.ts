import { isPitRoad, type LayerGroup, type PlacedObject } from '../types/trackObjects'

export function getLayerGroup(placed: PlacedObject): LayerGroup | null {
  if (placed.layerGroup) return placed.layerGroup

  switch (placed.type) {
    case 'curb':
      return 'curb'
    case 'painted_area':
      return 'painted'
    case 'edge_line':
      return 'edge'
    case 'road':
      return isPitRoad(placed.trackMode) ? 'pit' : 'surface'
    case 'track_ribbon': {
      const pts = placed.ribbonPoints
      if (pts === undefined) return null
      if (pts.length > 0 && pts.every(p => p.isPitLane)) return 'pit'
      return 'surface'
    }
    default:
      return null
  }
}
