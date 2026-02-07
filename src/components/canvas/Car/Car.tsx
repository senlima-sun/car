import { forwardRef, useRef, useEffect } from 'react'
import { Group } from 'three'
import { RigidBody, RapierRigidBody, CuboidCollider } from '@react-three/rapier'

import { CAR_WIDTH, CAR_HEIGHT, CAR_LENGTH, CAR_COLLISION_GROUPS } from '../../../constants/dimensions'
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
  const { carStateRef } = useCarFrame({
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
        <CuboidCollider
          args={[CAR_WIDTH / 2, CAR_HEIGHT / 2, CAR_LENGTH / 2]}
          position={[0, -0.17, 0.2]}
          collisionGroups={CAR_COLLISION_GROUPS}
        />
        <group ref={groupRef}>
          <CarBody />
        </group>
      </RigidBody>

      <CarSprayEffect carStateRef={carStateRef} />
    </>
  )
})

Car.displayName = 'Car'
export default Car
