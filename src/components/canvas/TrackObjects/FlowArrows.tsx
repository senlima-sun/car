import { useMemo } from 'react'
import { Vector3, QuadraticBezierCurve3 } from 'three'

interface FlowArrowsProps {
  startPoint: [number, number, number]
  endPoint: [number, number, number]
  controlPoint?: [number, number, number]
  flowDirection: 'forward' | 'backward' | null
  isCurve?: boolean
}

const ARROW_SPACING = 10
const ARROW_SIZE = 0.6
const ARROW_Y = 0.08

export default function FlowArrows({
  startPoint,
  endPoint,
  controlPoint,
  flowDirection,
  isCurve = false,
}: FlowArrowsProps) {
  if (!flowDirection) return null

  const arrows = useMemo(() => {
    const result: { position: [number, number, number]; rotation: number }[] = []

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
        result.push({
          position: [pos.x, ARROW_Y, pos.z],
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
        result.push({
          position: [
            startPoint[0] + dx * t,
            ARROW_Y,
            startPoint[2] + dz * t,
          ],
          rotation: rot,
        })
      }
    }

    return result
  }, [startPoint, endPoint, controlPoint, flowDirection, isCurve])

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
              color='#22c55e'
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}
