import { forwardRef, useRef, useEffect } from 'react'
import { Group } from 'three'
import { RigidBody, RapierRigidBody, BallCollider } from '@react-three/rapier'

import { WHEEL_POSITIONS, WHEEL_RADIUS, CAR_COLLISION_GROUPS } from '../../../constants/dimensions'
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
  const { carStateRef, suspensionOutputRef } = useCarFrame({
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
        linearDamping={0.01}
        angularDamping={1.5}
        type='dynamic'
        canSleep={false}
        enabledRotations={[true, true, true]}
        ccd={true}
      >
        <BallCollider args={[WHEEL_RADIUS]} position={[WHEEL_POSITIONS.FL[0], WHEEL_POSITIONS.FL[1], WHEEL_POSITIONS.FL[2]]} collisionGroups={CAR_COLLISION_GROUPS} mass={150} restitution={0} friction={1.5} />
        <BallCollider args={[WHEEL_RADIUS]} position={[WHEEL_POSITIONS.FR[0], WHEEL_POSITIONS.FR[1], WHEEL_POSITIONS.FR[2]]} collisionGroups={CAR_COLLISION_GROUPS} mass={150} restitution={0} friction={1.5} />
        <BallCollider args={[WHEEL_RADIUS]} position={[WHEEL_POSITIONS.RL[0], WHEEL_POSITIONS.RL[1], WHEEL_POSITIONS.RL[2]]} collisionGroups={CAR_COLLISION_GROUPS} mass={150} restitution={0} friction={1.5} />
        <BallCollider args={[WHEEL_RADIUS]} position={[WHEEL_POSITIONS.RR[0], WHEEL_POSITIONS.RR[1], WHEEL_POSITIONS.RR[2]]} collisionGroups={CAR_COLLISION_GROUPS} mass={150} restitution={0} friction={1.5} />
        <group ref={groupRef}>
          <CarBody suspensionRef={suspensionOutputRef} />
        </group>
      </RigidBody>

      <CarSprayEffect carStateRef={carStateRef} />
    </>
  )
})

Car.displayName = 'Car'
export default Car
