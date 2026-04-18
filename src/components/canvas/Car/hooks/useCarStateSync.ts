import { useRef } from 'react'
import { useTireStore } from '../../../../stores/useTireStore'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import { useAquaplaningStore } from '../../../../stores/useAquaplaningStore'
import { useErsStore } from '../../../../stores/useErsStore'
import { useActiveAeroStore } from '../../../../stores/useActiveAeroStore'
import { useBrakeStore } from '../../../../stores/useBrakeStore'
import { useWindStore } from '../../../../stores/useWindStore'
import { getErsState } from '../../../../wasm/PhysicsBridge'

export function useCarStateSync() {
  const syncAllTire = useTireStore(state => state.syncAllFromWasm)
  const syncTemperature = useTemperatureStore(state => state.syncFromWasm)
  const syncAllAquaplaning = useAquaplaningStore(state => state.syncAll)
  const syncErsState = useErsStore(state => state.syncFromPhysics)
  const syncAeroState = useActiveAeroStore(state => state.syncFromPhysics)
  const syncBrakeState = useBrakeStore(state => state.syncFromPhysics)
  const syncWindState = useWindStore(state => state.syncFromPhysics)
  const slowSyncCounter = useRef(0)

  const syncAll = (output: any, syncResult: any, windSyncNeeded: boolean) => {
    syncAeroState(syncResult.aero_state)
    syncBrakeState(syncResult.brake_state)

    if (windSyncNeeded) {
      syncWindState(syncResult.wind_state)
    }

    slowSyncCounter.current++
    const slowSync = slowSyncCounter.current % 3 === 0

    if (slowSync && output.tire_wear) {
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

    if (slowSync && output.temperature) {
      syncTemperature(output.temperature)
    }

    if (slowSync && output.aquaplaning && output.tire_thermal_shock) {
      syncAllAquaplaning(
        output.aquaplaning.is_aquaplaning,
        output.aquaplaning.intensity,
        output.aquaplaning.affected_wheels,
        output.tire_thermal_shock.is_shocked,
        output.tire_thermal_shock.grip_penalty,
        output.tire_thermal_shock.recovery_time,
      )
    }

    const ersData = output.ers && typeof output.ers.battery_charge === 'number'
      ? output.ers
      : getErsState()
    syncErsState(ersData)
  }

  return { syncAll }
}
