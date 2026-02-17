import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import type { FrontWingFlapRefs } from './BodyFrame'

const FW_MIDDLE_MAX_ANGLE = THREE.MathUtils.degToRad(20)
const FW_TOP_MAX_ANGLE = THREE.MathUtils.degToRad(15)

const _flapQ = new THREE.Quaternion()
const _yAxis = new THREE.Vector3(0, 1, 0)

interface FrontWingAnimatorProps {
  flapRefs: FrontWingFlapRefs
}

export function FrontWingAnimator({ flapRefs }: FrontWingAnimatorProps) {
  const baseQuaternions = useRef<{ middle: THREE.Quaternion | null; top: THREE.Quaternion | null }>({
    middle: null,
    top: null,
  })

  useEffect(() => {
    baseQuaternions.current = {
      middle: flapRefs.middle ? flapRefs.middle.quaternion.clone() : null,
      top: flapRefs.top ? flapRefs.top.quaternion.clone() : null,
    }
  }, [flapRefs])

  useFrame(() => {
    const { frontWingAngle } = useActiveAeroStore.getState()
    const base = baseQuaternions.current

    if (flapRefs.middle && base.middle) {
      _flapQ.setFromAxisAngle(_yAxis, FW_MIDDLE_MAX_ANGLE * frontWingAngle)
      flapRefs.middle.quaternion.copy(base.middle).multiply(_flapQ)
    }

    if (flapRefs.top && base.top) {
      _flapQ.setFromAxisAngle(_yAxis, FW_TOP_MAX_ANGLE * frontWingAngle)
      flapRefs.top.quaternion.copy(base.top).multiply(_flapQ)
    }
  })

  return null
}
