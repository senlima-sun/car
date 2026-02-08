import { useRef, MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import { useCarStore } from '../../../../stores/useCarStore'
import { WHEEL_POSITIONS as DIM_WHEEL_POS } from '../../../../constants/dimensions'
import { Wheel } from './Wheel'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

const WHEEL_POSITIONS: readonly (readonly [number, number, number])[] = [
  [DIM_WHEEL_POS.FL[0], DIM_WHEEL_POS.FL[1], DIM_WHEEL_POS.FL[2]],
  [DIM_WHEEL_POS.FR[0], DIM_WHEEL_POS.FR[1], DIM_WHEEL_POS.FR[2]],
  [DIM_WHEEL_POS.RL[0], DIM_WHEEL_POS.RL[1], DIM_WHEEL_POS.RL[2]],
  [DIM_WHEEL_POS.RR[0], DIM_WHEEL_POS.RR[1], DIM_WHEEL_POS.RR[2]],
]

interface WheelsGroupProps {
  isThermalView: boolean
  compoundColor: string
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function WheelsGroup({
  isThermalView,
  compoundColor,
  suspensionRef,
}: WheelsGroupProps) {
  const tires = useTemperatureStore(state => state.tires)

  const steerRef = useRef(0)
  const rotationsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const wheelYOffsetsRef = useRef([0, 0, 0, 0])

  useFrame(() => {
    const state = useCarStore.getState()
    steerRef.current = state.steerAngle
    rotationsRef.current = state.wheelRotations

    if (suspensionRef?.current) {
      for (let i = 0; i < 4; i++) {
        wheelYOffsetsRef.current[i] = suspensionRef.current.wheels[i].deflection
      }
    }
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

        const suspensionY = wheelYOffsetsRef.current[index]

        return (
          <Wheel
            key={index}
            position={[pos[0], pos[1] + suspensionY, pos[2]]}
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
