import { useMemo } from 'react'
import { getSnapAngles } from '@/utils/roadSnapping'
import { AngleGuideLine } from './AngleGuideLine'

const GUIDE_LENGTH = 30
const ANGLE_TOLERANCE = 0.01

export function AngleGuideLines({
  startPoint,
  activeAngle,
  angleIncrements,
}: {
  startPoint: [number, number, number]
  activeAngle: number | null
  angleIncrements: number[]
}) {
  const angles = useMemo(() => getSnapAngles(angleIncrements), [angleIncrements])

  return (
    <>
      {angles.map((angle, idx) => {
        const isActive = activeAngle !== null && Math.abs(angle - activeAngle) < ANGLE_TOLERANCE
        return (
          <AngleGuideLine
            key={idx}
            startPoint={startPoint}
            angle={angle}
            length={GUIDE_LENGTH}
            isActive={isActive}
          />
        )
      })}
    </>
  )
}
