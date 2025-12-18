import { CAR_SCALE } from '../../../../constants/physics'
import { TIRE_CONFIG } from '../../../../constants/tires'
import { useCarStore } from '../../../../stores/useCarStore'
import { useGameStore } from '../../../../stores/useGameStore'
import { useThermalViewStore } from '../../../../stores/useThermalViewStore'
import { useWeatherStore } from '../../../../stores/useWeatherStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import { useTireStore } from '../../../../stores/useTireStore'

import { BodyFrame } from './BodyFrame'
import { Cockpit } from './Cockpit'
import { WheelsGroup } from './WheelsGroup'
import DynamicParts from './DynamicParts'
import { useEngineThermal } from '../hooks/useEngineThermal'

export default function CarBody() {
  // Car state
  const steerAngle = useCarStore(state => state.steerAngle)
  const wheelRotations = useCarStore(state => state.wheelRotations)
  const speed = useCarStore(state => state.speed)
  const cameraMode = useGameStore(state => state.cameraMode)

  // Weather state for wet material
  const currentWeather = useWeatherStore(state => state.currentWeather)
  const customRainIntensity = useEnvironmentStore(state => state.rainIntensity)
  const isRaining = currentWeather === 'rain' || customRainIntensity > 0.01

  // Thermal view state
  const isThermalView = useThermalViewStore(state => state.isEnabled)

  // Tire compound for colored sidewalls
  const currentCompound = useTireStore(state => state.currentCompound)
  const compoundColor = TIRE_CONFIG[currentCompound].color

  // Engine thermal material
  const { engineThermalMaterial } = useEngineThermal()

  return (
    <group scale={CAR_SCALE}>
      {/* F1-style skeleton frame */}
      <BodyFrame
        isRaining={isRaining}
        isThermalView={isThermalView}
        engineThermalMaterial={engineThermalMaterial}
      />

      {/* Driver cockpit with steering wheel */}
      <Cockpit
        steerAngle={steerAngle}
        speed={speed}
        showSpeedDisplay={cameraMode === 'first-person'}
      />

      {/* All four wheels */}
      <WheelsGroup
        steerAngle={steerAngle}
        wheelRotations={wheelRotations}
        isThermalView={isThermalView}
        compoundColor={compoundColor}
      />

      {/* Custom parts from Part Editor (loads from localStorage) */}
      <DynamicParts loadFromStorage />
    </group>
  )
}
