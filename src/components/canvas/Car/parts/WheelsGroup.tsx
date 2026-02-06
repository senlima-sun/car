import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import { useCarStore } from '../../../../stores/useCarStore'
import { Wheel } from './Wheel'

const WHEEL_RADIUS = 0.3
const WHEEL_POSITIONS: readonly (readonly [number, number, number])[] = [
  [-0.82, 0, 1.8],
  [0.82, 0, 1.8],
  [-0.82, 0, -1.2],
  [0.82, 0, -1.2],
]

interface WheelsGroupProps {
  isThermalView: boolean
  compoundColor: string
}

export function WheelsGroup({
  isThermalView,
  compoundColor,
}: WheelsGroupProps) {
  const tires = useTemperatureStore(state => state.tires)

  const steerRef = useRef(0)
  const rotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])

  useFrame(() => {
    const state = useCarStore.getState()
    steerRef.current = state.steerAngle
    rotationsRef.current = state.wheelRotations
  })

  return (
    <>
      {WHEEL_POSITIONS.map((pos, index) => {
        const isFrontWheel = index < 2
        const isLeftWheel = pos[0] < 0

        let innerTemp = 0.15
        let outerTemp = 0.15

        switch (index) {
          case 0:
            innerTemp = tires.front_left_inner
            outerTemp = tires.front_left_outer
            break
          case 1:
            innerTemp = tires.front_right_inner
            outerTemp = tires.front_right_outer
            break
          case 2:
            innerTemp = tires.rear_left_inner
            outerTemp = tires.rear_left_outer
            break
          case 3:
            innerTemp = tires.rear_right_inner
            outerTemp = tires.rear_right_outer
            break
        }

        return (
          <Wheel
            key={index}
            position={[pos[0], -WHEEL_RADIUS + 0.25, pos[2]]}
            steerAngle={isFrontWheel ? steerRef.current : 0}
            wheelRotation={rotationsRef.current[index]}
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
