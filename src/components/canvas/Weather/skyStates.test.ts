import { describe, expect, it } from 'bun:test'
import { SKY_STATES, SKY_STATE_IDS, pickTopStates, computeWeights } from './skyStates'

describe('SKY_STATES config', () => {
  it('has 8 unique states with unique files', () => {
    expect(SKY_STATE_IDS).toHaveLength(8)
    const files = SKY_STATE_IDS.map(id => SKY_STATES[id].file)
    expect(new Set(files).size).toBe(8)
  })

  it('every state has positive exposure and rotationSpeed', () => {
    for (const id of SKY_STATE_IDS) {
      const c = SKY_STATES[id]
      expect(c.exposure).toBeGreaterThan(0)
      expect(c.rotationSpeed).toBeGreaterThan(0)
    }
  })
})

describe('pickTopStates', () => {
it('picks clear at hot dry midday', () => {
    const top = pickTopStates({ temperature: 25, rainIntensity: 0, isDusk: false }, 2)
    expect(top[0]).toBe('clear')
  })

  it('picks heavyRain or storm at heavy rain', () => {
    const top = pickTopStates({ temperature: 12, rainIntensity: 0.85, isDusk: false }, 2)
    expect(['heavyRain', 'storm']).toContain(top[0])
    expect(['heavyRain', 'storm']).toContain(top[1])
  })

  it('picks storm at extreme rain', () => {
    const top = pickTopStates({ temperature: 10, rainIntensity: 1.0, isDusk: false }, 1)
    expect(top[0]).toBe('storm')
  })

  it('picks goldenHour at clear dusk', () => {
    const top = pickTopStates({ temperature: 22, rainIntensity: 0, isDusk: true }, 1)
    expect(top[0]).toBe('goldenHour')
  })

  it('picks overcastDusk at cloudy dusk', () => {
    const top = pickTopStates({ temperature: 15, rainIntensity: 0.05, isDusk: true }, 1)
    expect(top[0]).toBe('overcastDusk')
  })

  it('picks overcast at moderate rain', () => {
    const top = pickTopStates({ temperature: 18, rainIntensity: 0.1, isDusk: false }, 1)
    expect(top[0]).toBe('overcast')
  })

  it('picks drizzle at moderate rain', () => {
    const top = pickTopStates({ temperature: 15, rainIntensity: 0.3, isDusk: false }, 1)
    expect(top[0]).toBe('drizzle')
  })

  it('keeps dusk states out of the top-2 when not dusk', () => {
    const top = pickTopStates({ temperature: 25, rainIntensity: 0, isDusk: false }, 2)
    expect(top).not.toContain('goldenHour')
    expect(top).not.toContain('overcastDusk')
  })

  it('returns exactly k entries', () => {
    expect(pickTopStates({ temperature: 20, rainIntensity: 0.2, isDusk: false }, 4)).toHaveLength(4)
    expect(pickTopStates({ temperature: 20, rainIntensity: 0.2, isDusk: false }, 1)).toHaveLength(1)
  })

  it('returns matching results for nearby inputs (smooth picker)', () => {
    const a = pickTopStates({ temperature: 25.1, rainIntensity: 0.001, isDusk: false }, 4)
    const b = pickTopStates({ temperature: 25.4, rainIntensity: 0.0, isDusk: false }, 4)
    expect(a).toEqual(b)
  })
})

describe('computeWeights', () => {
it('weights sum to 1', () => {
    const ids = pickTopStates({ temperature: 18, rainIntensity: 0.4, isDusk: false }, 4)
    const w = computeWeights({ temperature: 18, rainIntensity: 0.4, isDusk: false }, ids)
    const sum = w.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('places highest weight on the closest anchor', () => {
    const input = { temperature: 25, rainIntensity: 0, isDusk: false }
    const ids = pickTopStates(input, 4)
    const w = computeWeights(input, ids)
    const maxIdx = w.indexOf(Math.max(...w))
    expect(ids[maxIdx]).toBe('clear')
  })

  it('returns uniform weights when called with no states (defensive)', () => {
    const w = computeWeights({ temperature: 25, rainIntensity: 0, isDusk: false }, [])
    expect(w).toEqual([])
  })

  it('snaps to weight 1.0 on exact anchor match', () => {
    const input = { temperature: 25, rainIntensity: 0, isDusk: false }
    const w = computeWeights(input, ['clear'])
    expect(w[0]).toBeCloseTo(1, 5)
  })

  it('keeps all weights non-negative', () => {
    const ids = pickTopStates({ temperature: -5, rainIntensity: 0.5, isDusk: true }, 4)
    const w = computeWeights({ temperature: -5, rainIntensity: 0.5, isDusk: true }, ids)
    for (const x of w) expect(x).toBeGreaterThanOrEqual(0)
  })
})
