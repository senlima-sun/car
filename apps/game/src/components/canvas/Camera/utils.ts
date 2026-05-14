import { Quaternion, Euler, PerspectiveCamera as ThreePerspectiveCamera } from 'three'

const _euler = new Euler()

export function extractYawQuaternion(source: Quaternion, out: Quaternion): Quaternion {
  _euler.setFromQuaternion(source, 'YXZ')
  return out.setFromEuler(_euler.set(0, _euler.y, 0))
}

export function slerpOrSnap(
  camera: ThreePerspectiveCamera,
  target: Quaternion,
  factor: number,
  initialized: { current: boolean },
) {
  if (!initialized.current) {
    camera.quaternion.copy(target)
    initialized.current = true
  } else {
    camera.quaternion.slerp(target, factor)
  }
}
