import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSkidMarkStore } from '../../../stores/useSkidMarkStore'
import { useTireTrailStore } from '../../../stores/useTireTrailStore'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'

const MAX_POINTS_PER_WHEEL = 600
const MAX_STAMP_POOL = 128

const _pointPool = Array.from({ length: MAX_STAMP_POOL }, () => ({
  x: 0,
  z: 0,
  dirX: 0,
  dirZ: 0,
  intensity: 0,
  width: 0,
  isWet: false,
}))

export default function SkidMarkRenderer() {
  const { gl } = useThree()
  const init = useSkidMarkStore(s => s.init)
  const stampMarks = useSkidMarkStore(s => s.stampMarks)
  const decay = useSkidMarkStore(s => s.decay)

  const headTracker = useRef(new Uint32Array(4))
  const decayFrameCounter = useRef(0)

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

    let pointCount = 0

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

      for (let j = 0; j < count && pointCount < MAX_STAMP_POOL; j++) {
        const idx = base + ((start + j) % MAX_POINTS_PER_WHEEL)
        const intensity = trailStore.intensities[idx]
        if (intensity < 0.02) continue

        const pt = _pointPool[pointCount]
        pt.x = trailStore.xs[idx]
        pt.z = trailStore.zs[idx]
        pt.dirX = trailStore.dirXs[idx]
        pt.dirZ = trailStore.dirZs[idx]
        pt.intensity = intensity
        pt.width = trailStore.widths[idx]
        pt.isWet = trailStore.wet[idx] === 1
        pointCount++
      }

      headTracker.current[w] = currentHead
    }

    if (pointCount > 0) {
      stampMarks(gl, _pointPool.slice(0, pointCount))
    }

    if (!useSkidMarkStore.getState().hasMarks) return

    decayFrameCounter.current++
    if (decayFrameCounter.current % 3 !== 0) return
    decay(gl, dt * 3, env.rainIntensity, 20)
  })

  return null
}
