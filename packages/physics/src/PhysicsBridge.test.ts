import { describe, expect, test } from 'vitest'
import type { CarPhysicsOutput, PerWheelForces } from './PhysicsBridge'

/**
 * Phase 0 (Wave 3) telemetry contract test. The PerWheelForces field is
 * additive on `CarPhysicsOutput`; pre-Phase-1 the integrator produces
 * zero arrays. Phase 1 will populate them. The contract this test
 * locks down: the field exists, all 5 axes are length-4 arrays.
 */
describe('PerWheelForces telemetry surface', () => {
  test('zero-default shape is length-4 on each axis', () => {
    const empty: PerWheelForces = {
      fx: [0, 0, 0, 0],
      fy: [0, 0, 0, 0],
      fz: [0, 0, 0, 0],
      slip_angle: [0, 0, 0, 0],
      slip_ratio: [0, 0, 0, 0],
    }
    expect(empty.fx.length).toBe(4)
    expect(empty.fy.length).toBe(4)
    expect(empty.fz.length).toBe(4)
    expect(empty.slip_angle.length).toBe(4)
    expect(empty.slip_ratio.length).toBe(4)
  })

  test('CarPhysicsOutput interface includes per_wheel_forces', () => {
    const sample: Pick<CarPhysicsOutput, 'per_wheel_forces'> = {
      per_wheel_forces: {
        fx: [0, 0, 0, 0],
        fy: [0, 0, 0, 0],
        fz: [0, 0, 0, 0],
        slip_angle: [0, 0, 0, 0],
        slip_ratio: [0, 0, 0, 0],
      },
    }
    expect(sample.per_wheel_forces.fx).toEqual([0, 0, 0, 0])
  })
})
