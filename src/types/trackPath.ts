export interface TrackPathControlPoint {
  id: string
  position: [number, number]
  elevation: number
  widthOverride?: number
  banking?: number
  handleIn?: [number, number]
  handleOut?: [number, number]
}

export interface TrackPath {
  id: string
  name: string
  type: 'main' | 'pit'
  closed: boolean
  width: number
  controlPoints: TrackPathControlPoint[]
}
