import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '@/stores/useCarStore'
import { RPM_LIGHTS } from '@/constants/colors'

const LED_COUNT = 15
const MAX_RPM = 12500 // Based on the example

// Colors for the LEDs: 5 green, 5 red, 5 blue, as in the example
const LED_COLORS = [
  ...Array(5).fill(new THREE.Color(RPM_LIGHTS.green)),
  ...Array(5).fill(new THREE.Color(RPM_LIGHTS.red)),
  ...Array(5).fill(new THREE.Color(RPM_LIGHTS.blue)),
]

const OFF_COLOR = new THREE.Color(RPM_LIGHTS.off)

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

  useFrame(() => {
    const rpmRatio = rpm / MAX_RPM
    const litCount = Math.floor(rpmRatio * LED_COUNT)

    for (let i = 0; i < LED_COUNT; i++) {
      const led = ledRefs.current[i]
      if (led && led.material instanceof THREE.MeshStandardMaterial) {
        if (i < litCount) {
          led.material.emissive.set(LED_COLORS[i])
          led.material.emissiveIntensity = 3
        } else {
          led.material.emissive.set(OFF_COLOR)
          led.material.emissiveIntensity = 0
        }
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
