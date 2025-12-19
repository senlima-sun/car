import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { createCarbonFiberTexture } from '@/utils/createCarbonFiberTexture'
import { RPMLights } from './RPMLights'
import { SteeringWheelDisplay } from './SteeringWheelDisplay'

interface SteeringWheelProps {
  steerAngle: number
  showDisplay: boolean
}

// --- Materials ---
const carbonMap = createCarbonFiberTexture()
const carbonMaterial = new THREE.MeshStandardMaterial({
  map: carbonMap,
  roughness: 0.4,
  metalness: 0.1,
  color: 0xcccccc,
})
const suedeMaterial = new THREE.MeshStandardMaterial({
  color: 0x111111,
  roughness: 1.0,
  metalness: 0.0,
})
const housingMaterial = new THREE.MeshStandardMaterial({
  color: 0x080808,
  roughness: 0.2,
  metalness: 0.8,
})

// --- Geometry ---
const wheelShape = new THREE.Shape()
const w = 0.16 // Half width, scaled down from example
const h = 0.09 // Half height
wheelShape.moveTo(0, -h + 0.025)
wheelShape.lineTo(w - 0.075, -h + 0.025)
wheelShape.quadraticCurveTo(w, -h, w, -h + 0.075)
wheelShape.lineTo(w, h - 0.05)
wheelShape.quadraticCurveTo(w, h, w - 0.075, h)
wheelShape.lineTo(-w + 0.075, h)
wheelShape.quadraticCurveTo(-w, h, -w, h - 0.05)
wheelShape.lineTo(-w, -h + 0.075)
wheelShape.quadraticCurveTo(-w, -h, -w + 0.075, -h + 0.025)
wheelShape.lineTo(0, -h + 0.025)

const extrudeSettings = {
  depth: 0.02,
  bevelEnabled: true,
  bevelSegments: 2,
  steps: 2,
  bevelSize: 0.005,
  bevelThickness: 0.005,
}

/**
 * F1-style butterfly steering wheel with telemetry display
 */
export function SteeringWheel({ steerAngle, showDisplay }: SteeringWheelProps) {
  const steeringWheelRef = useRef<THREE.Group>(null)
  const smoothSteeringWheel = useRef(0)

  useFrame((_, delta) => {
    const lerpSpeed = 8
    smoothSteeringWheel.current = THREE.MathUtils.lerp(
      smoothSteeringWheel.current,
      steerAngle,
      lerpSpeed * delta,
    )

    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.y = -smoothSteeringWheel.current * 1.5
      steeringWheelRef.current.rotation.z = -smoothSteeringWheel.current * 0.1
    }
  })

  const chassisGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(wheelShape, extrudeSettings)
    geo.center()
    return geo
  }, [])

  return (
    <group position={[0, 0.32, 0.78]} rotation={[0.85, 0, 0]}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <group ref={steeringWheelRef}>
          <group rotation={[0.9, 0, Math.PI]}>
            {/* --- Chassis --- */}
            <mesh castShadow geometry={chassisGeo} material={carbonMaterial} />

            {/* --- Grips --- */}
            <mesh
              castShadow
              position={[-0.155, -0.01, 0]}
              rotation-z={0.1}
              material={suedeMaterial}
            >
              <capsuleGeometry args={[0.0325, 0.17, 4, 16]} />
            </mesh>
            <mesh
              castShadow
              position={[0.155, -0.01, 0]}
              rotation-z={-0.1}
              material={suedeMaterial}
            >
              <capsuleGeometry args={[0.0325, 0.17, 4, 16]} />
            </mesh>

            {/* --- Monitor Housing & Screen --- */}
            <group position={[0, 0.015, 0.0125]}>
              <RoundedBox
                args={[0.21, 0.13, 0.01]}
                radius={0.005}
                material={housingMaterial}
                castShadow
              >
                {showDisplay && <SteeringWheelDisplay />}
              </RoundedBox>

              {/* --- RPM LEDs --- */}
              <group position={[0, 0.07, 0]}>
                <mesh material={carbonMaterial} castShadow>
                  <boxGeometry args={[0.21, 0.02, 0.015]} />
                </mesh>
                <group position={[0, 0, 0.008]}>
                  <RPMLights />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
