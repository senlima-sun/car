import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { LIVERY, CARBON_FIBER, GLOSSY_ACCENT } from '../../../../constants/f1Livery'
import { createSpoonWingGeometry } from '../../../../utils/f1Geometry'

export function FrontWing() {
  const frontWingAngle = useActiveAeroStore(state => state.frontWingAngle)

  const flap1Ref = useRef<THREE.Group>(null)
  const flap2Ref = useRef<THREE.Group>(null)

  const smoothFlap1 = useRef(0)
  const smoothFlap2 = useRef(0)

  const spoonGeo = useMemo(() => createSpoonWingGeometry(1.9, 0.25, 28), [])
  const flapGeo1 = useMemo(() => createSpoonWingGeometry(1.88, 0.2, 24), [])
  const flapGeo2 = useMemo(() => createSpoonWingGeometry(1.86, 0.16, 24), [])

  useFrame((_, delta) => {
    const lerpSpeed = 4

    const targetFlap1 = -frontWingAngle * 0.3
    const targetFlap2 = -frontWingAngle * 0.52

    smoothFlap1.current = THREE.MathUtils.lerp(smoothFlap1.current, targetFlap1, lerpSpeed * delta)
    smoothFlap2.current = THREE.MathUtils.lerp(smoothFlap2.current, targetFlap2, lerpSpeed * delta)

    if (flap1Ref.current) flap1Ref.current.rotation.x = smoothFlap1.current
    if (flap2Ref.current) flap2Ref.current.rotation.x = smoothFlap2.current
  })

  return (
    <group position={[0, -0.25, 2.65]}>
      {/* Main spoon-shaped wing plane (fixed) */}
      <mesh castShadow receiveShadow geometry={spoonGeo}>
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} side={THREE.DoubleSide} />
      </mesh>

      {/* Flap 1 - primary adjustable */}
      <group ref={flap1Ref} position={[0, 0.025, 0]}>
        <mesh castShadow geometry={flapGeo1} position={[0, 0.012, 0]}>
          <meshStandardMaterial color={LIVERY.PRIMARY} roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Flap 2 - secondary adjustable */}
      <group ref={flap2Ref} position={[0, 0.05, 0]}>
        <mesh castShadow geometry={flapGeo2} position={[0, 0.012, 0]}>
          <meshStandardMaterial color={LIVERY.PRIMARY_LIGHT} roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Left nose strut */}
      <mesh castShadow position={[-0.12, 0.12, 0.04]}>
        <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Right nose strut */}
      <mesh castShadow position={[0.12, 0.12, 0.04]}>
        <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Left end plate */}
      <mesh castShadow position={[-0.95, 0.04, 0]}>
        <boxGeometry args={[0.015, 0.12, 0.32]} />
        <meshStandardMaterial color={LIVERY.ACCENT_YELLOW} {...GLOSSY_ACCENT} />
      </mesh>

      {/* Right end plate */}
      <mesh castShadow position={[0.95, 0.04, 0]}>
        <boxGeometry args={[0.015, 0.12, 0.32]} />
        <meshStandardMaterial color={LIVERY.ACCENT_YELLOW} {...GLOSSY_ACCENT} />
      </mesh>

      {/* Red accent strip on wing leading edge */}
      <mesh position={[0, -0.005, 0.12]}>
        <boxGeometry args={[1.5, 0.006, 0.02]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} {...GLOSSY_ACCENT} />
      </mesh>
    </group>
  )
}
