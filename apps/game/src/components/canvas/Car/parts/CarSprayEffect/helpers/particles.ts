export interface ParticleData {
  positions: Float32Array
  velocities: Float32Array
  sizes: Float32Array
  opacities: Float32Array
  lifetimes: Float32Array
  maxLifetimes: Float32Array
  active: Uint8Array
  activeCount: number
}

export type ParticleKind = 'spray' | 'mist' | 'droplet'

const KIND_INIT: Record<
  ParticleKind,
  { sizeMin: number; sizeRange: number; opacityMin: number; opacityRange: number; lifeMin: number; lifeRange: number }
> = {
  spray: { sizeMin: 0.15, sizeRange: 0.2, opacityMin: 0.5, opacityRange: 0.3, lifeMin: 0.4, lifeRange: 0.4 },
  mist: { sizeMin: 0.3, sizeRange: 0.5, opacityMin: 0.15, opacityRange: 0.2, lifeMin: 0.8, lifeRange: 0.8 },
  droplet: { sizeMin: 0.08, sizeRange: 0.1, opacityMin: 0.7, opacityRange: 0.3, lifeMin: 0.3, lifeRange: 0.3 },
}

export function initParticleData(count: number, kind: ParticleKind): ParticleData {
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const opacities = new Float32Array(count)
  const lifetimes = new Float32Array(count)
  const maxLifetimes = new Float32Array(count)
  const active = new Uint8Array(count)

  const init = KIND_INIT[kind]
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] = -100
    sizes[i] = init.sizeMin + Math.random() * init.sizeRange
    opacities[i] = init.opacityMin + Math.random() * init.opacityRange
    maxLifetimes[i] = init.lifeMin + Math.random() * init.lifeRange
  }

  return {
    positions,
    velocities,
    sizes,
    opacities,
    lifetimes,
    maxLifetimes,
    active,
    activeCount: 0,
  }
}

export function deactivateParticle(data: ParticleData, index: number) {
  data.active[index] = 0
  data.activeCount--
  data.positions[index * 3 + 1] = -100
}

export function advanceParticle(
  data: ParticleData,
  index: number,
  dt: number,
  gravity: number,
  drag: number,
  withTurbulence: boolean,
) {
  const i3 = index * 3
  const pos = data.positions
  const vel = data.velocities

  pos[i3] += vel[i3] * dt
  pos[i3 + 1] += vel[i3 + 1] * dt
  pos[i3 + 2] += vel[i3 + 2] * dt

  vel[i3 + 1] -= gravity * dt

  vel[i3] *= drag
  vel[i3 + 1] *= drag
  vel[i3 + 2] *= drag

  if (withTurbulence) {
    vel[i3] += (Math.random() - 0.5) * 2 * dt
    vel[i3 + 2] += (Math.random() - 0.5) * 2 * dt
  }
}
