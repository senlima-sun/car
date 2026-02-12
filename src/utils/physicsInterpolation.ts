import { Vector3, Quaternion } from 'three'

export function interpolateVector3(a: Vector3, b: Vector3, alpha: number): Vector3 {
  return new Vector3().lerpVectors(a, b, alpha)
}

export function interpolateQuaternion(a: Quaternion, b: Quaternion, alpha: number): Quaternion {
  return new Quaternion().slerpQuaternions(a, b, alpha)
}

export function interpolateScalar(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha
}

export interface PhysicsState {
  position: Vector3
  rotation: Quaternion
  linearVelocity: Vector3
  angularVelocity: Vector3
}

export function interpolatePhysicsState(
  previous: PhysicsState,
  current: PhysicsState,
  alpha: number,
): PhysicsState {
  return {
    position: interpolateVector3(previous.position, current.position, alpha),
    rotation: interpolateQuaternion(previous.rotation, current.rotation, alpha),
    linearVelocity: interpolateVector3(previous.linearVelocity, current.linearVelocity, alpha),
    angularVelocity: interpolateVector3(previous.angularVelocity, current.angularVelocity, alpha),
  }
}
