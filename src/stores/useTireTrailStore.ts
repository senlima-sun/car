import { create } from 'zustand'

const BASE_POINTS_PER_WHEEL = 600
const TOTAL_POINTS = BASE_POINTS_PER_WHEEL * 4

const MAX_POINTS_PER_WHEEL = BASE_POINTS_PER_WHEEL
const RUBBER_UV_DECAY_RATE = 0.033
const RUBBER_RAIN_WASH_RATE = 0.5
const COLD_DECAY_MULT = 0.5
const HOT_DECAY_MULT = 1.8

interface TireTrailStore {
  xs: Float32Array
  zs: Float32Array
  ys: Float32Array
  dirXs: Float32Array
  dirZs: Float32Array
  intensities: Float32Array
  ages: Float32Array
  widths: Float32Array
  wet: Uint8Array
  heads: Uint32Array
  counts: Uint32Array
  totalActive: number

  addPoint: (
    wheel: number,
    x: number,
    z: number,
    y: number,
    dirX: number,
    dirZ: number,
    intensity: number,
    width: number,
    isWet: boolean,
  ) => void
  tick: (dt: number, rainIntensity: number, temperature: number) => void
  clear: () => void
}

export const useTireTrailStore = create<TireTrailStore>((set, get) => ({
  xs: new Float32Array(TOTAL_POINTS),
  zs: new Float32Array(TOTAL_POINTS),
  ys: new Float32Array(TOTAL_POINTS),
  dirXs: new Float32Array(TOTAL_POINTS),
  dirZs: new Float32Array(TOTAL_POINTS),
  intensities: new Float32Array(TOTAL_POINTS),
  ages: new Float32Array(TOTAL_POINTS),
  widths: new Float32Array(TOTAL_POINTS),
  wet: new Uint8Array(TOTAL_POINTS),
  heads: new Uint32Array(4),
  counts: new Uint32Array(4),
  totalActive: 0,

  addPoint(wheel, x, z, y, dirX, dirZ, intensity, width, isWet) {
    const s = get()
    const base = wheel * MAX_POINTS_PER_WHEEL
    const head = s.heads[wheel]
    const idx = base + head

    s.xs[idx] = x
    s.zs[idx] = z
    s.ys[idx] = y
    s.dirXs[idx] = dirX
    s.dirZs[idx] = dirZ
    s.intensities[idx] = intensity
    s.ages[idx] = 0
    s.widths[idx] = width
    s.wet[idx] = isWet ? 1 : 0

    s.heads[wheel] = (head + 1) % MAX_POINTS_PER_WHEEL
    if (s.counts[wheel] < MAX_POINTS_PER_WHEEL) {
      s.counts[wheel]++
    }
  },

  tick(dt, rainIntensity, temperature) {
    const s = get()
    const intensities = s.intensities
    const ages = s.ages
    const wet = s.wet

    let tempMult = 1
    if (temperature < 5) tempMult = COLD_DECAY_MULT
    else if (temperature > 35) tempMult = HOT_DECAY_MULT

    let active = 0
    for (let w = 0; w < 4; w++) {
      const base = w * MAX_POINTS_PER_WHEEL
      const count = s.counts[w]
      for (let i = 0; i < count; i++) {
        const idx = base + i
        if (intensities[idx] <= 0) continue

        ages[idx] += dt

        const isWet = wet[idx] === 1
        let decayRate: number
        if (isWet) {
          decayRate = 0.2 * tempMult
        } else {
          decayRate = RUBBER_UV_DECAY_RATE * tempMult
        }

        if (rainIntensity > 0.01) {
          decayRate += RUBBER_RAIN_WASH_RATE * rainIntensity
        }

        intensities[idx] -= decayRate * dt

        if (intensities[idx] <= 0) {
          intensities[idx] = 0
        } else {
          active++
        }
      }
    }

    set({ totalActive: active })
  },

  clear() {
    const s = get()
    s.intensities.fill(0)
    s.ages.fill(0)
    s.heads.fill(0)
    s.counts.fill(0)
    set({ totalActive: 0 })
  },
}))

export { MAX_POINTS_PER_WHEEL, TOTAL_POINTS }
