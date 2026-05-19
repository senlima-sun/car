import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import type { RearWingFlapRefs } from './BodyFrame'

const BW_LAST_MAX_ANGLE = THREE.MathUtils.degToRad(30)

const _flapQ = new THREE.Quaternion()
const _flapAxis = new THREE.Vector3(1, 0, 0)

interface RearWingAnimatorProps {
  flapRefs: RearWingFlapRefs
}

export function RearWingAnimator({ flapRefs }: RearWingAnimatorProps) {
  const baseQuaternions = useRef<{
    last: THREE.Quaternion | null
  }>({
    last: null,
  })

  useEffect(() => {
    baseQuaternions.current = {
      last: flapRefs.last ? flapRefs.last.quaternion.clone() : null,
    }
  }, [flapRefs])

  useFrame(() => {
    const { rearWingAngle } = useActiveAeroStore.getState()
    const clampedRearWingAngle = THREE.MathUtils.clamp(rearWingAngle, 0, 1)
    const base = baseQuaternions.current

    if (flapRefs.last && base.last) {
      _flapQ.setFromAxisAngle(_flapAxis, BW_LAST_MAX_ANGLE * clampedRearWingAngle)
      flapRefs.last.quaternion.copy(base.last).multiply(_flapQ)
    }
  })

  return null
}
