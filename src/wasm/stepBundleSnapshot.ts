import type { StepAndSyncOutput, AmbientConditions } from './PhysicsBridge'

export interface StepBundleSnapshot {
  version: number
  ambient: AmbientConditions
  worldDownforce: [number, number, number]
  output: StepAndSyncOutput | null
}

const snapshot: StepBundleSnapshot = {
  version: 0,
  ambient: { temperature: 0.643, humidity: 0.3, rain_intensity: 0 },
  worldDownforce: [0, 0, 0],
  output: null,
}

export function publishStepBundle(result: StepAndSyncOutput): void {
  snapshot.version++
  snapshot.ambient = result.ambient ?? snapshot.ambient
  snapshot.worldDownforce = result.world_downforce ?? snapshot.worldDownforce
  snapshot.output = result
}

export function readStepBundle(): StepBundleSnapshot {
  return snapshot
}
