import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '@/stores/useCarStore'
import { RPM_LIGHTS } from '@/constants/colors'

const LED_COUNT = 15
const MAX_RPM = 12500
const SHIFT_THRESHOLD = 0.95
const SHIFT_BLINK_FREQ = 8

const LED_COLORS = [
  ...Array(5).fill(new THREE.Color(RPM_LIGHTS.green)),
  ...Array(5).fill(new THREE.Color(RPM_LIGHTS.red)),
  ...Array(5).fill(new THREE.Color(RPM_LIGHTS.blue)),
]

const OFF_COLOR = new THREE.Color(RPM_LIGHTS.off)
const SHIFT_COLOR = new THREE.Color(0x4444ff)

export function RPMLights() {
  const rpm = useCarStore(state => state.rpm)
  const ledRefs = useRef<(THREE.Mesh | null)[]>([])

  const ledGeometries = useMemo(() => {
    const geometries = []
    for (let i = 0; i < LED_COUNT; i++) {
      geometries.push(<boxGeometry args={[0.01, 0.015, 0.01]} />)
    }
    return geometries
  }, [])

  useFrame(state => {
    const rpmRatio = rpm / MAX_RPM
    const litCount = Math.floor(rpmRatio * LED_COUNT)
    const isShiftZone = rpmRatio >= SHIFT_THRESHOLD
    const shiftBlink =
      isShiftZone && Math.sin(state.clock.elapsedTime * Math.PI * 2 * SHIFT_BLINK_FREQ) > 0

    for (let i = 0; i < LED_COUNT; i++) {
      const led = ledRefs.current[i]
      if (!led || !(led.material instanceof THREE.MeshStandardMaterial)) continue

      if (isShiftZone) {
        if (shiftBlink) {
          led.material.emissive.copy(SHIFT_COLOR)
          led.material.emissiveIntensity = 8
        } else {
          led.material.emissive.set(OFF_COLOR)
          led.material.emissiveIntensity = 0
        }
      } else if (i < litCount) {
        led.material.emissive.copy(LED_COLORS[i])
        const distFromTop = litCount - 1 - i
        const falloff = Math.max(0.4, 1 - distFromTop * 0.08)
        led.material.emissiveIntensity = 5 * falloff
      } else {
        led.material.emissive.set(OFF_COLOR)
        led.material.emissiveIntensity = 0
      }
    }
  })

  return (
    <group>
      {ledGeometries.map((geo, i) => {
        const startX = -0.09
        const spacing = 0.18 / (LED_COUNT - 1)
        return (
          <mesh
            key={i}
            ref={el => {
              ledRefs.current[i] = el
            }}
            position={[startX + i * spacing, 0, 0]}
          >
            {geo}
            <meshStandardMaterial color={OFF_COLOR} emissive={OFF_COLOR} emissiveIntensity={0} />
          </mesh>
        )
      })}
    </group>
  )
}
