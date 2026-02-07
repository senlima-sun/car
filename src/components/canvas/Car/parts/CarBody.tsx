import { MutableRefObject } from 'react'
import { CAR_SCALE } from '../../../../constants/physics'
import { TIRE_CONFIG } from '../../../../constants/tires'
import { useGameStore } from '../../../../stores/useGameStore'
import { useThermalViewStore } from '../../../../stores/useThermalViewStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import { useTireStore } from '../../../../stores/useTireStore'

import { BodyFrame } from './BodyFrame'
import { Cockpit } from './Cockpit'
import { WheelsGroup } from './WheelsGroup'
import DynamicParts from './DynamicParts'
import { FrontWing } from './FrontWing'
import { RearWing } from './RearWing'
import { useEngineThermal } from '../hooks/useEngineThermal'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

interface CarBodyProps {
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export default function CarBody({ suspensionRef }: CarBodyProps) {
  const cameraMode = useGameStore(state => state.cameraMode)
  const rainIntensity = useEnvironmentStore(state => state.rainIntensity)
  const isRaining = rainIntensity > 0.01
  const isThermalView = useThermalViewStore(state => state.isEnabled)
  const currentCompound = useTireStore(state => state.currentCompound)
  const compoundColor = TIRE_CONFIG[currentCompound].color
  const { engineThermalMaterial } = useEngineThermal()

  return (
    <group scale={CAR_SCALE}>
      <BodyFrame
        isRaining={isRaining}
        isThermalView={isThermalView}
        engineThermalMaterial={engineThermalMaterial}
      />
      <Cockpit steerAngle={0} showDisplay={cameraMode === 'first-person'} />
      <WheelsGroup
        isThermalView={isThermalView}
        compoundColor={compoundColor}
        suspensionRef={suspensionRef}
      />
      <FrontWing />
      <RearWing />
      <DynamicParts loadFromStorage />
    </group>
  )
}
