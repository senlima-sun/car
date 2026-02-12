import { useRef } from 'react'
import { FIXED_TIME_STEP, MAX_ACCUMULATED_TIME } from '@/constants/physics'

export function usePhysicsAccumulator() {
  const accumulatorRef = useRef(0)

  const accumulate = (deltaTime: number): { steps: number; alpha: number } => {
    const clampedDelta = Math.min(deltaTime, MAX_ACCUMULATED_TIME)
    accumulatorRef.current += clampedDelta

    let steps = 0
    while (accumulatorRef.current >= FIXED_TIME_STEP) {
      accumulatorRef.current -= FIXED_TIME_STEP
      steps++
    }

    const alpha = accumulatorRef.current / FIXED_TIME_STEP

    return { steps, alpha }
  }

  const reset = () => {
    accumulatorRef.current = 0
  }

  return { accumulate, reset, fixedTimeStep: FIXED_TIME_STEP }
}
