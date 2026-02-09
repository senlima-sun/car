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
const screenBezelMaterial = new THREE.MeshStandardMaterial({
  color: 0x050505,
  roughness: 0.1,
  metalness: 0.9,
})
const paddleMaterial = new THREE.MeshStandardMaterial({
  color: 0x888888,
  roughness: 0.3,
  metalness: 0.6,
})
const buttonRedMaterial = new THREE.MeshStandardMaterial({
  color: 0xcc2222,
  roughness: 0.5,
  metalness: 0.3,
  emissive: new THREE.Color(0x440000),
  emissiveIntensity: 0.3,
})
const buttonBlueMaterial = new THREE.MeshStandardMaterial({
  color: 0x2244cc,
  roughness: 0.5,
  metalness: 0.3,
  emissive: new THREE.Color(0x000044),
  emissiveIntensity: 0.3,
})
const buttonYellowMaterial = new THREE.MeshStandardMaterial({
  color: 0xccaa22,
  roughness: 0.5,
  metalness: 0.3,
  emissive: new THREE.Color(0x222200),
  emissiveIntensity: 0.3,
})
const rotaryMaterial = new THREE.MeshStandardMaterial({
  color: 0x333333,
  roughness: 0.4,
  metalness: 0.5,
})

const wheelShape = new THREE.Shape()
const w = 0.16
const h = 0.09
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

            {/* --- Decorative Buttons (Left) --- */}
            <mesh castShadow position={[-0.09, 0.055, 0.012]} material={buttonRedMaterial}>
              <cylinderGeometry args={[0.008, 0.008, 0.006, 12]} />
            </mesh>
            <mesh castShadow position={[-0.065, 0.06, 0.012]} material={buttonBlueMaterial}>
              <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
            </mesh>
            <mesh castShadow position={[-0.115, 0.045, 0.012]} material={buttonYellowMaterial}>
              <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
            </mesh>

            {/* --- Decorative Buttons (Right) --- */}
            <mesh castShadow position={[0.09, 0.055, 0.012]} material={buttonYellowMaterial}>
              <cylinderGeometry args={[0.008, 0.008, 0.006, 12]} />
            </mesh>
            <mesh castShadow position={[0.065, 0.06, 0.012]} material={buttonRedMaterial}>
              <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
            </mesh>
            <mesh castShadow position={[0.115, 0.045, 0.012]} material={buttonBlueMaterial}>
              <cylinderGeometry args={[0.007, 0.007, 0.006, 12]} />
            </mesh>

            {/* --- Rotary Encoders --- */}
            <mesh castShadow position={[-0.13, 0.02, 0.012]} rotation-x={Math.PI / 2} material={rotaryMaterial}>
              <cylinderGeometry args={[0.01, 0.012, 0.008, 16]} />
            </mesh>
            <mesh castShadow position={[0.13, 0.02, 0.012]} rotation-x={Math.PI / 2} material={rotaryMaterial}>
              <cylinderGeometry args={[0.01, 0.012, 0.008, 16]} />
            </mesh>

            {/* --- Shift Paddles (Behind wheel) --- */}
            <mesh castShadow position={[-0.11, -0.01, -0.025]} rotation-z={0.15} material={paddleMaterial}>
              <boxGeometry args={[0.05, 0.025, 0.003]} />
            </mesh>
            <mesh castShadow position={[0.11, -0.01, -0.025]} rotation-z={-0.15} material={paddleMaterial}>
              <boxGeometry args={[0.05, 0.025, 0.003]} />
            </mesh>

            {/* --- Monitor Housing & Screen --- */}
            <group position={[0, 0.015, 0.0125]}>
              {/* Outer housing (carbon fiber) */}
              <RoundedBox
                args={[0.28, 0.165, 0.012]}
                radius={0.006}
                material={carbonMaterial}
                castShadow
              />
              {/* Inner bezel (glossy black) */}
              <RoundedBox
                args={[0.275, 0.16, 0.011]}
                radius={0.005}
                material={screenBezelMaterial}
                castShadow
                position={[0, 0, 0.001]}
              />
              {/* Screen area */}
              <RoundedBox
                args={[0.27, 0.155, 0.01]}
                radius={0.005}
                material={housingMaterial}
                castShadow
                position={[0, 0, 0.002]}
              >
                {showDisplay && <SteeringWheelDisplay />}
              </RoundedBox>

              {/* --- RPM LEDs --- */}
              <group position={[0, 0.09, 0]}>
                <mesh material={carbonMaterial} castShadow>
                  <boxGeometry args={[0.28, 0.022, 0.015]} />
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
