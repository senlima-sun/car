import { useRef, RefObject } from 'react'
import { Group, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface FreeCameraProps {
  target: RefObject<Group | null>
}

export default function FreeCamera({ target }: FreeCameraProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)

  useFrame(() => {
    if (!target.current || !controlsRef.current) return

    // Update orbit target to car's world position
    const carPosition = new Vector3()
    target.current.getWorldPosition(carPosition)
    controlsRef.current.target.copy(carPosition)
    controlsRef.current.update()
  })

  return (
    <>
      <PerspectiveCamera makeDefault fov={75} near={0.1} far={1000} position={[0, 5, 10]} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 + 0.3}
      />
    </>
  )
}
