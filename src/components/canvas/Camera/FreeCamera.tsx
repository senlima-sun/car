import { useRef, useEffect } from 'react'
import { Vector3, MOUSE } from 'three'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CAMERA_NEAR, CAMERA_FAR } from './constants'
import type { CameraTargetProps } from './types'

const MOVE_SPEED = 75
const FAST_MULTIPLIER = 3
const VERTICAL_SPEED = 15

const MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
} as const

const keys = new Set<string>()

const onKeyDown = (e: KeyboardEvent) => keys.add(e.code)
const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)

const _forward = new Vector3()
const _right = new Vector3()
const _offset = new Vector3()

export default function FreeCamera({ target }: CameraTargetProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()

  useEffect(() => {
    if (!target.current || !controlsRef.current) return

    const carPosition = new Vector3()
    target.current.getWorldPosition(carPosition)
    camera.position.set(carPosition.x - 8, carPosition.y + 5, carPosition.z - 8)
    controlsRef.current.target.copy(carPosition)
    controlsRef.current.update()
  }, [target, camera])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keys.clear()
    }
  }, [])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    const speed =
      (keys.has('ShiftLeft') || keys.has('ShiftRight')
        ? MOVE_SPEED * FAST_MULTIPLIER
        : MOVE_SPEED) * delta

    camera.getWorldDirection(_forward)
    _forward.y = 0
    _forward.normalize()

    _right.crossVectors(_forward, camera.up).normalize()

    _offset.set(0, 0, 0)

    if (keys.has('KeyW') || keys.has('ArrowUp')) _offset.addScaledVector(_forward, speed)
    if (keys.has('KeyS') || keys.has('ArrowDown')) _offset.addScaledVector(_forward, -speed)
    if (keys.has('KeyA') || keys.has('ArrowLeft')) _offset.addScaledVector(_right, -speed)
    if (keys.has('KeyD') || keys.has('ArrowRight')) _offset.addScaledVector(_right, speed)
    if (keys.has('Space')) _offset.y += VERTICAL_SPEED * delta
    if (keys.has('KeyX')) _offset.y -= VERTICAL_SPEED * delta

    if (_offset.lengthSq() === 0) return

    controls.target.add(_offset)
    camera.position.add(_offset)
    controls.update()
  })

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={75}
        near={CAMERA_NEAR}
        far={CAMERA_FAR}
        position={[0, 5, 10]}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        screenSpacePanning={false}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2 + 0.3}
        mouseButtons={MOUSE_BUTTONS}
      />
    </>
  )
}
