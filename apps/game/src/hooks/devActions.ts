import { useStartLightsStore } from '../stores/useStartLightsStore'

export type DevActionId = 'start-lights'

const DEV_ACTIONS: Record<DevActionId, () => void> = {
  'start-lights': () => {
    const lights = useStartLightsStore.getState()
    if (lights.status === 'idle') lights.arm('manual')
  },
}

export function runDevAction(id: DevActionId): void {
  DEV_ACTIONS[id]()
}
