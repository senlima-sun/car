import { VEHICLE_CONFIG } from '../../../../constants/physics'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import { Wheel } from './Wheel'

interface WheelsGroupProps {
  steerAngle: number
  wheelRotations: number[]
  isThermalView: boolean
  compoundColor: string
}

/**
 * Component that renders all four wheels with temperature data
 */
export function WheelsGroup({
  steerAngle,
  wheelRotations,
  isThermalView,
  compoundColor,
}: WheelsGroupProps) {
  const { wheels } = VEHICLE_CONFIG
  const tires = useTemperatureStore(state => state.tires)

  return (
    <>
      {wheels.positions.map((pos, index) => {
        const isFrontWheel = index < 2
        const isLeftWheel = pos[0] < 0

        // Get temperature for this wheel (index: 0=FL, 1=FR, 2=RL, 3=RR)
        let innerTemp = 0.15
        let outerTemp = 0.15

        switch (index) {
          case 0: // Front Left
            innerTemp = tires.front_left_inner
            outerTemp = tires.front_left_outer
            break
          case 1: // Front Right
            innerTemp = tires.front_right_inner
            outerTemp = tires.front_right_outer
            break
          case 2: // Rear Left
            innerTemp = tires.rear_left_inner
            outerTemp = tires.rear_left_outer
            break
          case 3: // Rear Right
            innerTemp = tires.rear_right_inner
            outerTemp = tires.rear_right_outer
            break
        }

        return (
          <Wheel
            key={index}
            position={[pos[0], -wheels.radius + 0.25, pos[2]]}
            steerAngle={isFrontWheel ? steerAngle : 0}
            wheelRotation={wheelRotations[index]}
            isLeft={isLeftWheel}
            innerTemp={innerTemp}
            outerTemp={outerTemp}
            isThermalView={isThermalView}
            compoundColor={compoundColor}
          />
        )
      })}
    </>
  )
}
