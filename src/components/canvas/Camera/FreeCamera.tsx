import { useRef, useEffect, RefObject } from 'react'
import { Group, Vector3, MOUSE } from 'three'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface FreeCameraProps {
  target: RefObject<Group | null>
}

export default function FreeCamera({ target }: FreeCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  // Initialize orbit target to car position once on mount
  useEffect(() => {
    if (!target.current || !controlsRef.current) return

    const carPosition = new Vector3()
    target.current.getWorldPosition(carPosition)
    controlsRef.current.target.copy(carPosition)
    controlsRef.current.update()
  }, [target])

  return (
    <>
      <PerspectiveCamera makeDefault fov={75} near={0.1} far={1000} position={[0, 5, 10]} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        screenSpacePanning={false}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2 + 0.3}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
      />
    </>
  )
}
