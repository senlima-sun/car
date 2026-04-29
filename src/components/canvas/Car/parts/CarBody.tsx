import { MutableRefObject, useCallback, useState } from 'react'
import { CAR_SCALE } from '../../../../constants/physics'
import { useGameStore } from '../../../../stores/useGameStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'

import { BodyFrame } from './BodyFrame'
import type { GltfWheelRefs, FrontWingFlapRefs, RearWingFlapRefs } from './BodyFrame'
import { GltfWheelAnimator } from './GltfWheelAnimator'
import { FrontWingAnimator } from './FrontWing'
import { RearWingAnimator } from './RearWing'
import { Cockpit } from './Cockpit'
import DynamicParts from './DynamicParts'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

interface CarBodyProps {
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export default function CarBody({ suspensionRef }: CarBodyProps) {
  const cameraMode = useGameStore(state => state.cameraMode)
  const rainIntensity = useEnvironmentStore(state => state.rainIntensity)
  const isRaining = rainIntensity > 0.01

  const [wheelRefs, setWheelRefs] = useState<GltfWheelRefs>({
    fl: null,
    fr: null,
    rl: null,
    rr: null,
  })

  const [fwRefs, setFwRefs] = useState<FrontWingFlapRefs>({
    middle: null,
    top: null,
  })

  const [rwRefs, setRwRefs] = useState<RearWingFlapRefs>({
    middle: null,
    last: null,
  })

  const handleWheelRefs = useCallback((refs: GltfWheelRefs) => {
    setWheelRefs(refs)
  }, [])

  const handleFrontWingRefs = useCallback((refs: FrontWingFlapRefs) => {
    setFwRefs(refs)
  }, [])

  const handleRearWingRefs = useCallback((refs: RearWingFlapRefs) => {
    setRwRefs(refs)
  }, [])

  return (
    <group scale={CAR_SCALE}>
      <BodyFrame
        isRaining={isRaining}
        suspensionRef={suspensionRef}
        onWheelRefs={handleWheelRefs}
        onFrontWingRefs={handleFrontWingRefs}
        onRearWingRefs={handleRearWingRefs}
      />
      <Cockpit steerAngle={0} showDisplay={cameraMode === 'first-person'} />
      <GltfWheelAnimator wheelRefs={wheelRefs} />
      <FrontWingAnimator flapRefs={fwRefs} />
      <RearWingAnimator flapRefs={rwRefs} />
      <DynamicParts loadFromStorage />
    </group>
  )
}
