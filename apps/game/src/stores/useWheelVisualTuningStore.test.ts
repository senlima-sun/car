import { afterEach, describe, expect, test } from 'vitest'
import { useWheelVisualTuningStore } from './useWheelVisualTuningStore'

afterEach(() => {
  useWheelVisualTuningStore.getState().reset()
})

describe('useWheelVisualTuningStore', () => {
  test('starts with mirrored camber defaults', () => {
    const { wheels } = useWheelVisualTuningStore.getState()
    expect(wheels.fl.camberDeg).toBe(3.5)
    expect(wheels.fr.camberDeg).toBe(-3.5)
    expect(wheels.rl.camberDeg).toBe(0)
    expect(wheels.rr.camberDeg).toBe(0)
    expect(wheels.fl.spinAxis).toEqual({ x: 1, y: 0.07, z: 0 })
    expect(wheels.fr.spinAxis).toEqual({ x: 1, y: -0.07, z: 0 })
    expect(wheels.rl.spinAxis).toEqual({ x: 1, y: 0.02, z: 0 })
    expect(wheels.rr.spinAxis).toEqual({ x: 1, y: -0.02, z: 0 })
  })

  test('updates wheel tuning independently', () => {
    const store = useWheelVisualTuningStore.getState()
    store.setWheelCamber('fl', 5.2)
    store.setWheelSpinSign('fr', -1)
    store.setWheelSpinAxis('fr', 'y', -0.12)
    store.setWheelOffset('rl', 'z', 0.04)

    const { wheels } = useWheelVisualTuningStore.getState()
    expect(wheels.fl.camberDeg).toBe(5.2)
    expect(wheels.fr.spinSign).toBe(-1)
    expect(wheels.fr.spinAxis.y).toBe(-0.12)
    expect(wheels.rl.offset.z).toBe(0.04)
    expect(wheels.rr.offset.z).toBe(0)
  })

  test('reset restores defaults', () => {
    const store = useWheelVisualTuningStore.getState()
    store.setWheelCamber('fl', 8)
    store.setWheelOffset('fl', 'x', 0.1)
    store.reset()

    const { wheels } = useWheelVisualTuningStore.getState()
    expect(wheels.fl.camberDeg).toBe(3.5)
    expect(wheels.fl.spinAxis).toEqual({ x: 1, y: 0.07, z: 0 })
    expect(wheels.fl.offset).toEqual({ x: 0, y: 0, z: 0 })
  })
})
