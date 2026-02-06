import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3 } from 'three'

interface FlowArrowsProps {
  startPoint: [number, number, number]
  endPoint: [number, number, number]
  controlPoint?: [number, number, number]
  flowDirection: 'forward' | 'backward' | null
  isCurve?: boolean
  startElevation?: number
  endElevation?: number
  isSelected?: boolean
  hasError?: boolean
}

const ARROW_SPACING = 10
const ARROW_SIZE = 0.6

export default function FlowArrows({
  startPoint,
  endPoint,
  controlPoint,
  flowDirection,
  isCurve = false,
  startElevation,
  endElevation,
  isSelected = false,
  hasError = false,
}: FlowArrowsProps) {
  if (!flowDirection) return null

  const arrows = useMemo(() => {
    const result: { position: [number, number, number]; rotation: number }[] = []
    const startElev = startElevation ?? 0
    const endElev = endElevation ?? 0

    if (isCurve && controlPoint) {
      const start = new Vector3(...startPoint)
      const control = new Vector3(...controlPoint)
      const end = new Vector3(...endPoint)
      const curve = new QuadraticBezierCurve3(start, control, end)
      const curveLength = curve.getLength()
      const count = Math.max(1, Math.floor(curveLength / ARROW_SPACING))

      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const effectiveT = flowDirection === 'backward' ? 1 - t : t
        const pos = curve.getPoint(effectiveT)
        const tangent = curve.getTangent(effectiveT)
        if (flowDirection === 'backward') {
          tangent.negate()
        }
        const rot = Math.atan2(tangent.x, tangent.z)
        const y = startElev + (endElev - startElev) * effectiveT + 0.08
        result.push({
          position: [pos.x, y, pos.z],
          rotation: rot,
        })
      }
    } else {
      const dx = endPoint[0] - startPoint[0]
      const dz = endPoint[2] - startPoint[2]
      const length = Math.sqrt(dx * dx + dz * dz)
      const count = Math.max(1, Math.floor(length / ARROW_SPACING))

      const dirX = flowDirection === 'backward' ? -dx / length : dx / length
      const dirZ = flowDirection === 'backward' ? -dz / length : dz / length
      const rot = Math.atan2(dirX, dirZ)

      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const y = startElev + (endElev - startElev) * t + 0.08
        result.push({
          position: [
            startPoint[0] + dx * t,
            y,
            startPoint[2] + dz * t,
          ],
          rotation: rot,
        })
      }
    }

    return result
  }, [startPoint, endPoint, controlPoint, flowDirection, isCurve, startElevation, endElevation])

  const arrowColor = hasError ? '#ef4444' : isSelected ? '#f97316' : '#22c55e'
  const arrowOpacity = isSelected ? 0.9 : 0.7

  return (
    <>
      {arrows.map((arrow, i) => (
        <group
          key={i}
          position={arrow.position}
          rotation={[-Math.PI / 2, 0, arrow.rotation]}
        >
          {/* Arrow triangle */}
          <mesh>
            <coneGeometry args={[ARROW_SIZE * 0.5, ARROW_SIZE, 3]} />
            <meshBasicMaterial
              color={arrowColor}
              transparent
              opacity={arrowOpacity}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}
