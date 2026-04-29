import { describe, expect, it } from 'bun:test'
import {
  advanceParticle,
  deactivateParticle,
  initParticleData,
  type ParticleData,
} from './particles'

describe('initParticleData', () => {
  it('allocates typed arrays of correct size', () => {
    const d = initParticleData(10, 'spray')
    expect(d.positions.length).toBe(30)
    expect(d.velocities.length).toBe(30)
    expect(d.sizes.length).toBe(10)
    expect(d.opacities.length).toBe(10)
    expect(d.lifetimes.length).toBe(10)
    expect(d.maxLifetimes.length).toBe(10)
    expect(d.active.length).toBe(10)
    expect(d.activeCount).toBe(0)
  })

  it('hides initial particles below ground', () => {
    const d = initParticleData(5, 'spray')
    for (let i = 0; i < 5; i++) {
      expect(d.positions[i * 3 + 1]).toBe(-100)
    }
  })

  it('all particles start inactive', () => {
    const d = initParticleData(5, 'mist')
    for (let i = 0; i < 5; i++) {
      expect(d.active[i]).toBe(0)
    }
    expect(d.lifetimes[0]).toBe(0)
  })

  it('size range matches kind preset (mist > spray > droplet)', () => {
    const sprayD = initParticleData(50, 'spray')
    const mistD = initParticleData(50, 'mist')
    const dropletD = initParticleData(50, 'droplet')

    const avg = (arr: Float32Array) => Array.from(arr).reduce((a, b) => a + b, 0) / arr.length
    expect(avg(mistD.sizes)).toBeGreaterThan(avg(sprayD.sizes))
    expect(avg(sprayD.sizes)).toBeGreaterThan(avg(dropletD.sizes))
  })
})

describe('deactivateParticle', () => {
  it('flips active flag, decrements count, hides position', () => {
    const d = initParticleData(3, 'spray')
    d.active[1] = 1
    d.activeCount = 1
    d.positions[1 * 3 + 1] = 5

    deactivateParticle(d, 1)

    expect(d.active[1]).toBe(0)
    expect(d.activeCount).toBe(0)
    expect(d.positions[1 * 3 + 1]).toBe(-100)
  })
})

describe('advanceParticle', () => {
  function makeActiveAt(idx: number): ParticleData {
    const d = initParticleData(3, 'spray')
    d.positions[idx * 3] = 0
    d.positions[idx * 3 + 1] = 1
    d.positions[idx * 3 + 2] = 0
    d.velocities[idx * 3] = 1
    d.velocities[idx * 3 + 1] = 2
    d.velocities[idx * 3 + 2] = 3
    d.active[idx] = 1
    d.activeCount = 1
    return d
  }

  it('advances position by velocity * dt', () => {
    const d = makeActiveAt(0)
    advanceParticle(d, 0, 0.5, 0, 1, false)
    expect(d.positions[0]).toBeCloseTo(0.5, 6)
    expect(d.positions[1]).toBeCloseTo(2, 6)
    expect(d.positions[2]).toBeCloseTo(1.5, 6)
  })

  it('applies gravity to vertical velocity', () => {
    const d = makeActiveAt(0)
    advanceParticle(d, 0, 1, 10, 1, false)
    expect(d.velocities[1]).toBeCloseTo(2 - 10, 6)
  })

  it('applies drag multiplicatively to all velocity axes', () => {
    const d = makeActiveAt(0)
    advanceParticle(d, 0, 0, 0, 0.5, false)
    expect(d.velocities[0]).toBeCloseTo(0.5, 6)
    expect(d.velocities[1]).toBeCloseTo(1, 6)
    expect(d.velocities[2]).toBeCloseTo(1.5, 6)
  })

  it('does not allocate new arrays — typed-array identity preserved', () => {
    const d = makeActiveAt(0)
    const positionsRef = d.positions
    const velocitiesRef = d.velocities
    advanceParticle(d, 0, 0.5, 5, 0.9, true)
    expect(d.positions).toBe(positionsRef)
    expect(d.velocities).toBe(velocitiesRef)
  })
})
