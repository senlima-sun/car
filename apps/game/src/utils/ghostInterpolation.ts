import * as THREE from 'three'
import type { GhostReplayData } from './ghostReplayDB'

export interface GhostFrameState {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  steerAngle: number
  wheelRotations: [number, number, number, number]
}

function findFrameIndex(timestamps: Float32Array, frameCount: number, time: number): number {
  let lo = 0
  let hi = frameCount - 1

  if (time <= timestamps[0]) return 0
  if (time >= timestamps[hi]) return hi - 1

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (timestamps[mid] <= time) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return lo
}

function catmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

const _q0 = new THREE.Quaternion()
const _q1 = new THREE.Quaternion()
const _outPos = new THREE.Vector3()
const _outQuat = new THREE.Quaternion()
const _outWheels: [number, number, number, number] = [0, 0, 0, 0]

const _sharedState: GhostFrameState = {
  position: _outPos,
  quaternion: _outQuat,
  steerAngle: 0,
  wheelRotations: _outWheels,
}

export function interpolateGhostState(
  replay: GhostReplayData,
  time: number,
): GhostFrameState | null {
  const { frameCount, positions, rotations, steerAngles, wheelRotations, timestamps } = replay
  if (frameCount < 2) return null
  if (time < timestamps[0] || time > timestamps[frameCount - 1]) return null

  const i = findFrameIndex(timestamps, frameCount, time)
  const t0 = timestamps[i]
  const t1 = timestamps[i + 1]
  const alpha = t1 > t0 ? (time - t0) / (t1 - t0) : 0

  const i0 = Math.max(i - 1, 0)
  const i1 = i
  const i2 = Math.min(i + 1, frameCount - 1)
  const i3 = Math.min(i + 2, frameCount - 1)

  _outPos.set(
    catmullRom(alpha, positions[i0 * 3], positions[i1 * 3], positions[i2 * 3], positions[i3 * 3]),
    catmullRom(
      alpha,
      positions[i0 * 3 + 1],
      positions[i1 * 3 + 1],
      positions[i2 * 3 + 1],
      positions[i3 * 3 + 1],
    ),
    catmullRom(
      alpha,
      positions[i0 * 3 + 2],
      positions[i1 * 3 + 2],
      positions[i2 * 3 + 2],
      positions[i3 * 3 + 2],
    ),
  )

  _q0.set(rotations[i1 * 4], rotations[i1 * 4 + 1], rotations[i1 * 4 + 2], rotations[i1 * 4 + 3])
  _q1.set(rotations[i2 * 4], rotations[i2 * 4 + 1], rotations[i2 * 4 + 2], rotations[i2 * 4 + 3])
  _outQuat.slerpQuaternions(_q0, _q1, alpha)

  _outWheels[0] = THREE.MathUtils.lerp(wheelRotations[i1 * 4], wheelRotations[i2 * 4], alpha)
  _outWheels[1] = THREE.MathUtils.lerp(
    wheelRotations[i1 * 4 + 1],
    wheelRotations[i2 * 4 + 1],
    alpha,
  )
  _outWheels[2] = THREE.MathUtils.lerp(
    wheelRotations[i1 * 4 + 2],
    wheelRotations[i2 * 4 + 2],
    alpha,
  )
  _outWheels[3] = THREE.MathUtils.lerp(
    wheelRotations[i1 * 4 + 3],
    wheelRotations[i2 * 4 + 3],
    alpha,
  )

  _sharedState.steerAngle = THREE.MathUtils.lerp(steerAngles[i1], steerAngles[i2], alpha)

  return _sharedState
}
