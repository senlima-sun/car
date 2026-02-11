import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSkidMarkStore } from '../../../stores/useSkidMarkStore'
import { useTireTrailStore } from '../../../stores/useTireTrailStore'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'

const MAX_POINTS_PER_WHEEL = 600

export default function SkidMarkRenderer() {
  const { gl } = useThree()
  const init = useSkidMarkStore(s => s.init)
  const stampMarks = useSkidMarkStore(s => s.stampMarks)
  const decay = useSkidMarkStore(s => s.decay)

  const headTracker = useRef(new Uint32Array(4))

  useEffect(() => {
    init()
    return () => {
      useSkidMarkStore.getState().dispose()
    }
  }, [init])

  useFrame((_, delta) => {
    const trailStore = useTireTrailStore.getState()
    const env = useEnvironmentStore.getState()
    const dt = Math.min(delta, 0.05)

    const points: {
      x: number
      z: number
      dirX: number
      dirZ: number
      intensity: number
      width: number
      isWet: boolean
    }[] = []

    for (let w = 0; w < 4; w++) {
      const base = w * MAX_POINTS_PER_WHEEL
      const currentHead = trailStore.heads[w]
      const prevHead = headTracker.current[w]

      if (currentHead === prevHead) continue

      let start = prevHead
      let count: number
      if (currentHead > prevHead) {
        count = currentHead - prevHead
      } else {
        count = MAX_POINTS_PER_WHEEL - prevHead + currentHead
      }

      for (let j = 0; j < count; j++) {
        const idx = base + ((start + j) % MAX_POINTS_PER_WHEEL)
        const intensity = trailStore.intensities[idx]
        if (intensity < 0.02) continue

        points.push({
          x: trailStore.xs[idx],
          z: trailStore.zs[idx],
          dirX: trailStore.dirXs[idx],
          dirZ: trailStore.dirZs[idx],
          intensity,
          width: trailStore.widths[idx],
          isWet: trailStore.wet[idx] === 1,
        })
      }

      headTracker.current[w] = currentHead
    }

    if (points.length > 0) {
      stampMarks(gl, points)
    }

    decay(gl, dt, env.rainIntensity, 20)
  })

  return null
}
