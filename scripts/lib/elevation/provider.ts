export type ProviderName =
  | 'opentopography-cop30'
  | 'open-elevation'
  | 'mapbox-terrain-rgb'
  | 'none'
export type DemName = 'GLO-30' | 'SRTM' | 'MAPBOX' | 'flat'
export type DatumName = 'EGM2008' | 'MAPBOX_NATIVE' | 'flat'

export interface ElevationGrid {
  south: number
  north: number
  west: number
  east: number
  cols: number
  rows: number
  data: Float32Array
  provider: ProviderName
  dem: DemName
  datum: DatumName
}

export interface ElevationProviderError {
  retryable: boolean
  message: string
  status?: number
}

export class ProviderError extends Error implements ElevationProviderError {
  retryable: boolean
  status?: number
  constructor(message: string, opts: { retryable: boolean; status?: number }) {
    super(message)
    this.name = 'ProviderError'
    this.retryable = opts.retryable
    this.status = opts.status
  }
}

export interface ElevationProvider {
  readonly name: ProviderName
  readonly dem: DemName
  readonly datum: DatumName
  fetch(args: {
    south: number
    north: number
    west: number
    east: number
    targetCols: number
    targetRows: number
  }): Promise<ElevationGrid>
}
