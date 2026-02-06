import { useMemo } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useGameStore } from '../../../stores/useGameStore'

const GRID_ROWS = 4
const ROW_SPACING = 6
const COLUMN_OFFSET = 3
const GRID_MARKER_SIZE = 0.8

export default function StartGrid() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const isCustomizeMode = useGameStore(s => s.status) === 'customize'

  const startFinish = useMemo(
    () =>
      placedObjects.find(
        o => o.type === 'checkpoint' && (o.checkpointType ?? 'start-finish') === 'start-finish',
      ),
    [placedObjects],
  )

  const gridPositions = useMemo(() => {
    if (!startFinish?.startPoint || !startFinish?.endPoint) return []

    const cx = (startFinish.startPoint[0] + startFinish.endPoint[0]) / 2
    const cz = (startFinish.startPoint[2] + startFinish.endPoint[2]) / 2
    const rot = startFinish.rotation

    const behindX = -Math.sin(rot)
    const behindZ = -Math.cos(rot)

    const lateralX = Math.cos(rot)
    const lateralZ = -Math.sin(rot)

    const positions: Array<{ position: [number, number, number]; row: number; col: number }> = []

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < 2; col++) {
        const rowOffset = (row + 1) * ROW_SPACING
        const colOffset = col === 0 ? -COLUMN_OFFSET : COLUMN_OFFSET
        const stagger = col === 1 ? ROW_SPACING * 0.4 : 0

        positions.push({
          position: [
            cx + behindX * (rowOffset + stagger) + lateralX * colOffset,
            0.05,
            cz + behindZ * (rowOffset + stagger) + lateralZ * colOffset,
          ],
          row,
          col,
        })
      }
    }

    return positions
  }, [startFinish])

  if (!isCustomizeMode || !startFinish || gridPositions.length === 0) return null

  return (
    <group>
      {gridPositions.map(({ position, row, col }) => (
        <group key={`grid-${row}-${col}`} position={position}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[GRID_MARKER_SIZE * 2, GRID_MARKER_SIZE * 3]} />
            <meshStandardMaterial
              color='#ffffff'
              emissive='#ffffff'
              emissiveIntensity={0.3}
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[GRID_MARKER_SIZE * 1.6, GRID_MARKER_SIZE * 2.6]} />
            <meshStandardMaterial color='#222222' transparent opacity={0.6} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
