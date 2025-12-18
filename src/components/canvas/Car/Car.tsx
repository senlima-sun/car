import { forwardRef, useRef, useEffect } from 'react'
import { Group } from 'three'
import { RigidBody, RapierRigidBody, CuboidCollider } from '@react-three/rapier'

import { CAR_SCALE } from '../../../constants/physics'
import CarBody from './parts/CarBody'
import CarSprayEffect from './parts/CarSprayEffect'
import { useCarFrame } from './hooks/useCarFrame'
import { usePhysicsSync } from './hooks/usePhysicsSync'
import { useStartPosition } from './hooks/useStartPosition'

// Car with WASM physics engine
const Car = forwardRef<Group>((_, ref) => {
  const chassisRef = useRef<RapierRigidBody>(null)
  const groupRef = useRef<Group>(null)

  const { physics, windEnabled } = usePhysicsSync()

  // Calculate start position from checkpoint
  const { startPosition, startRotation } = useStartPosition()

  // Main physics frame loop
  const { carState } = useCarFrame({
    chassisRef,
    physics,
    windEnabled,
    startPosition,
  })

  // Sync ref to parent
  useEffect(() => {
    if (ref && typeof ref === 'object' && groupRef.current) {
      ref.current = groupRef.current
    }
  }, [ref])

  return (
    <>
      <RigidBody
        ref={chassisRef}
        position={startPosition}
        rotation={startRotation}
        colliders={false}
        mass={600}
        linearDamping={0.01}
        angularDamping={1.5}
        type='dynamic'
        canSleep={false}
        enabledRotations={[true, true, true]}
        ccd={true}
      >
        {/* Manual collider sized to match wheel bottoms (scaled by CAR_SCALE) */}
        <CuboidCollider
          args={[0.9 * CAR_SCALE, 0.18 * CAR_SCALE, 1.8 * CAR_SCALE]}
          position={[0, -0.17 * CAR_SCALE, 0.2 * CAR_SCALE]}
        />
        <group ref={groupRef}>
          <CarBody />
        </group>
      </RigidBody>

      <CarSprayEffect
        carPosition={carState.position}
        carVelocity={carState.velocity}
        carRotation={carState.rotation}
      />
    </>
  )
})

Car.displayName = 'Car'
export default Car
