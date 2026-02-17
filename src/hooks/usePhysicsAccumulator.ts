import { useRef } from 'react'
import { FIXED_TIME_STEP, MAX_ACCUMULATED_TIME } from '@/constants/physics'

const MAX_STEPS_PER_FRAME = 8

export function usePhysicsAccumulator() {
  const accumulatorRef = useRef(0)

  const accumulate = (deltaTime: number): { steps: number; alpha: number } => {
    const clampedDelta = Math.min(deltaTime, MAX_ACCUMULATED_TIME)
    accumulatorRef.current += clampedDelta

    let steps = 0
    while (accumulatorRef.current >= FIXED_TIME_STEP && steps < MAX_STEPS_PER_FRAME) {
      accumulatorRef.current -= FIXED_TIME_STEP
      steps++
    }

    if (accumulatorRef.current > FIXED_TIME_STEP * 2) {
      accumulatorRef.current = 0
    }

    const alpha = accumulatorRef.current / FIXED_TIME_STEP

    return { steps, alpha }
  }

  const reset = () => {
    accumulatorRef.current = 0
  }

  return { accumulate, reset, fixedTimeStep: FIXED_TIME_STEP }
}
