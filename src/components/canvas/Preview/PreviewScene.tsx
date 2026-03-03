import { Suspense } from 'react'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import CarBody from '../Car/parts/CarBody'
import { WHEEL_RADIUS } from '@/constants/dimensions'

export default function PreviewScene() {
  return (
    <>
      <PerspectiveCamera makeDefault fov={50} near={0.1} far={100} position={[4, 2.5, 6]} />
      <OrbitControls
        target={[0, 0.5, 0]}
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 + 0.1}
      />

      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />
      <hemisphereLight args={['#b1e1ff', '#444444', 0.6]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color='#2a2a2a' roughness={0.85} />
      </mesh>

      <Suspense fallback={null}>
        <group position={[0, WHEEL_RADIUS, 0]}>
          <CarBody />
        </group>
      </Suspense>
    </>
  )
}
