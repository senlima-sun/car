import { useMemo } from 'react'
import {
  useStartLightsStore,
  START_LIGHTS_COLUMNS,
  START_LIGHTS_LAMPS_PER_COLUMN,
} from '@/stores/useStartLightsStore'

interface StartLightsGantryProps {
  length: number
}

const PYLON_HEIGHT = 4.2
const BEAM_Y = PYLON_HEIGHT + 1.4
const BEAM_HEIGHT = 0.5
const POST_RADIUS = 0.18
const LAMP_RADIUS = 0.22
const LAMP_GAP = 0.6
const COLUMN_GAP_RATIO = 0.85

export default function StartLightsGantry({ length }: StartLightsGantryProps) {
  const litColumns = useStartLightsStore(s => s.litColumns)
  const status = useStartLightsStore(s => s.status)

  const beamLength = useMemo(() => Math.min(length + 1.2, 13.2), [length])
  const halfBeam = beamLength / 2
  const columnSpan = beamLength * COLUMN_GAP_RATIO
  const columnSpacing = columnSpan / (START_LIGHTS_COLUMNS - 1)
  const columnStartZ = -columnSpan / 2
  const lampStartY = BEAM_Y - BEAM_HEIGHT / 2 - LAMP_RADIUS - 0.05

  const columns = useMemo(() => {
    const cols: Array<{ z: number; lamps: number[] }> = []
    for (let c = 0; c < START_LIGHTS_COLUMNS; c++) {
      const lamps: number[] = []
      for (let r = 0; r < START_LIGHTS_LAMPS_PER_COLUMN; r++) {
        lamps.push(lampStartY - r * (LAMP_RADIUS * 2 + LAMP_GAP * 0.5))
      }
      cols.push({ z: columnStartZ + c * columnSpacing, lamps })
    }
    return cols
  }, [columnSpacing, columnStartZ, lampStartY])

  const isVisible = status !== 'idle'

  return (
    <group visible={isVisible}>
      <mesh position={[0, BEAM_Y, 0]}>
        <boxGeometry args={[0.8, BEAM_HEIGHT, beamLength]} />
        <meshStandardMaterial color='#dcdcdc' metalness={0.4} roughness={0.55} />
      </mesh>

      <mesh position={[0, BEAM_Y + BEAM_HEIGHT / 2 + 0.05, 0]}>
        <boxGeometry args={[0.6, 0.08, beamLength + 0.4]} />
        <meshStandardMaterial color='#1a1a1a' metalness={0.6} roughness={0.4} />
      </mesh>

      {[halfBeam, -halfBeam].map(z => (
        <mesh key={z} position={[0, BEAM_Y / 2 + 0.1, z]}>
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS * 1.2, BEAM_Y - 0.2, 8]} />
          <meshStandardMaterial color='#dcdcdc' metalness={0.4} roughness={0.55} />
        </mesh>
      ))}

      {columns.map((col, ci) => {
        const on = ci < litColumns
        return (
          <group key={ci} position={[0, 0, col.z]}>
            <mesh position={[0, BEAM_Y - BEAM_HEIGHT / 2 - 0.05, 0]}>
              <boxGeometry args={[0.7, 0.1, LAMP_RADIUS * 2 + 0.2]} />
              <meshStandardMaterial color='#0a0a0a' metalness={0.7} roughness={0.4} />
            </mesh>
            {col.lamps.map((y, li) => (
              <Lamp key={li} y={y} z={0} on={on} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Lamp({ y, z, on }: { y: number; z: number; on: boolean }) {
  return (
    <mesh position={[0.42, y, z]}>
      <sphereGeometry args={[LAMP_RADIUS, 16, 12]} />
      <meshStandardMaterial
        color={on ? '#ff2222' : '#1a0606'}
        emissive={on ? '#ff2222' : '#000000'}
        emissiveIntensity={on ? 2.4 : 0}
        roughness={0.35}
      />
    </mesh>
  )
}
