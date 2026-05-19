const DEFAULT_RANGE_TOLERANCE_MIN_MULT = 0.25
const DEFAULT_RANGE_TOLERANCE_MAX_MULT = 10
const DEFAULT_MAX_NEIGHBOUR_DELTA_M = 150

export interface Landmark {
  worldX: number
  worldZ: number
  expectedHeight: number
  toleranceM: number
  label: string
}

export interface HeightmapValidationOptions {
  expectedRangeMeters: number
  rangeToleranceMultiplier?: { min: number; max: number }
  maxNeighbourDeltaM?: number
  landmarks?: Landmark[]
}

export interface HeightmapValidationReport {
  pass: boolean
  reasons: string[]
  observedRange: number
  observedMin: number
  observedMax: number
  landmarkResults: Array<{ label: string; observed: number; expected: number; deltaM: number; ok: boolean }>
}

export function validateHeightmap(args: {
  heightmap: Float32Array
  resolution: number
  worldSize: number
  options: HeightmapValidationOptions
  sampleAt: (worldX: number, worldZ: number) => number
}): HeightmapValidationReport {
  const { heightmap, resolution, options, sampleAt } = args
  const reasons: string[] = []

  let allZero = true
  let observedMin = Infinity
  let observedMax = -Infinity
  for (let i = 0; i < heightmap.length; i++) {
    const v = heightmap[i]!
    if (!Number.isFinite(v)) {
      reasons.push(`cell ${i} is non-finite (${v})`)
      continue
    }
    if (v !== 0) allZero = false
    if (v < observedMin) observedMin = v
    if (v > observedMax) observedMax = v
  }

  if (allZero) reasons.push('heightmap is all-zero')

  const observedRange = observedMax - observedMin
  const minMult = options.rangeToleranceMultiplier?.min ?? DEFAULT_RANGE_TOLERANCE_MIN_MULT
  const maxMult = options.rangeToleranceMultiplier?.max ?? DEFAULT_RANGE_TOLERANCE_MAX_MULT
  if (!allZero) {
    if (observedRange < options.expectedRangeMeters * minMult) {
      reasons.push(
        `range ${observedRange.toFixed(1)}m < ${minMult}× expected ${options.expectedRangeMeters}m`
      )
    }
    if (observedRange > options.expectedRangeMeters * maxMult) {
      reasons.push(
        `range ${observedRange.toFixed(1)}m > ${maxMult}× expected ${options.expectedRangeMeters}m`
      )
    }
  }

  const maxNeighbourDelta = options.maxNeighbourDeltaM ?? DEFAULT_MAX_NEIGHBOUR_DELTA_M
  for (let gz = 0; gz < resolution; gz++) {
    for (let gx = 0; gx < resolution - 1; gx++) {
      const a = heightmap[gz * resolution + gx]!
      const b = heightmap[gz * resolution + gx + 1]!
      if (Math.abs(a - b) > maxNeighbourDelta) {
        reasons.push(`neighbour delta at (${gx},${gz})/(${gx + 1},${gz}) = ${Math.abs(a - b).toFixed(1)}m`)
        gx = resolution
        gz = resolution
      }
    }
  }
  for (let gx = 0; gx < resolution; gx++) {
    for (let gz = 0; gz < resolution - 1; gz++) {
      const a = heightmap[gz * resolution + gx]!
      const b = heightmap[(gz + 1) * resolution + gx]!
      if (Math.abs(a - b) > maxNeighbourDelta) {
        reasons.push(`neighbour delta at (${gx},${gz})/(${gx},${gz + 1}) = ${Math.abs(a - b).toFixed(1)}m`)
        gx = resolution
        gz = resolution
      }
    }
  }

  const landmarkResults: HeightmapValidationReport['landmarkResults'] = []
  if (options.landmarks) {
    for (const lm of options.landmarks) {
      const observed = sampleAt(lm.worldX, lm.worldZ)
      const deltaM = observed - lm.expectedHeight
      const ok = Math.abs(deltaM) <= lm.toleranceM
      landmarkResults.push({ label: lm.label, observed, expected: lm.expectedHeight, deltaM, ok })
      if (!ok) {
        reasons.push(
          `landmark ${lm.label}: observed ${observed.toFixed(2)}m, expected ${lm.expectedHeight}±${lm.toleranceM}m`
        )
      }
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    observedRange,
    observedMin,
    observedMax,
    landmarkResults,
  }
}
