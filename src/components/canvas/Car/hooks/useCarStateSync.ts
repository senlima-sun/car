import { useRef } from 'react'
import { useCarStore } from '../../../../stores/useCarStore'
import { useTireStore } from '../../../../stores/useTireStore'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { useBrakeStore } from '../../../../stores/useBrakeStore'
import { useWindStore } from '../../../../stores/useWindStore'
import { getErsState } from '../../../../wasm/PhysicsBridge'
import { type CarPhysicsOutput, type StepAndSyncOutput } from '../../../../wasm'

const ERS_SYNC_EVERY = 2
const UI_SYNC_EVERY = 4
const SLOW_SYNC_EVERY = 6

export function useCarStateSync() {
  const syncAllTire = useTireStore(state => state.syncAllFromWasm)
  const syncTemperature = useTemperatureStore(state => state.syncFromWasm)
  const syncErsState = useErsStore(state => state.syncFromPhysics)
  const syncAeroState = useActiveAeroStore(state => state.syncFromPhysics)
  const syncBrakeState = useBrakeStore(state => state.syncFromPhysics)
  const syncWindState = useWindStore(state => state.syncFromPhysics)
  const counterRef = useRef(0)

  const syncAll = (output: CarPhysicsOutput, syncResult: StepAndSyncOutput, windSyncNeeded: boolean) => {
    const count = counterRef.current++
    const ersSync = count % ERS_SYNC_EVERY === 0
    const uiSync = count % UI_SYNC_EVERY === 0
    const slowSync = count % SLOW_SYNC_EVERY === 0

    if (ersSync) {
      const ersData =
        output.ers && typeof output.ers.battery_charge === 'number' ? output.ers : getErsState()
      syncErsState(ersData)
    }

    if (uiSync) {
      syncAeroState(syncResult.aero_state)
      syncBrakeState(syncResult.brake_state)
      const boost = output.boost_pressure_bar
      if (Number.isFinite(boost)) {
        useCarStore.setState({ boostPressure: boost })
      }
    }

    if (windSyncNeeded) {
      syncWindState(syncResult.wind_state)
    }

    if (slowSync) {
      if (output.tire_wear) {
        syncAllTire(
          {
            frontLeft: output.tire_wear.front_left * 100,
            frontRight: output.tire_wear.front_right * 100,
            rearLeft: output.tire_wear.rear_left * 100,
            rearRight: output.tire_wear.rear_right * 100,
          },
          output.effective_grip,
          output.grip_breakdown ?? null,
          output.tire_material ?? null,
        )
      }

      if (output.temperature) {
        syncTemperature(output.temperature)
      }
    }
  }

  return { syncAll }
}
