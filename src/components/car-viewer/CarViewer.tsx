import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { StaticCar } from './StaticCar'

export default function CarViewer() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#404040' }}>
      <div style={{
        position: 'absolute',
        top: 12,
        left: 16,
        zIndex: 10,
        color: '#aaa',
        fontFamily: 'monospace',
        fontSize: 13,
      }}>
        <span style={{ color: '#fff', fontWeight: 600 }}>Car Viewer</span>
        {' '}&mdash; orbit: drag / zoom: scroll / pan: right-drag
        <span style={{ marginLeft: 16 }}>
          <a href="#/" style={{ color: '#666', textDecoration: 'none' }}>back to game</a>
        </span>
      </div>

      <Canvas
        shadows
        camera={{ position: [4, 2.5, 6], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, toneMapping: 3, toneMappingExposure: 1.2 }}
      >
        <color attach="background" args={['#505050']} />
        <fog attach="fog" args={['#505050', 15, 40]} />

        <ambientLight intensity={0.4} />
        <directionalLight
          position={[8, 10, 5]}
          intensity={1.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={30}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <directionalLight position={[-5, 3, -4]} intensity={0.3} color="#4466aa" />
        <pointLight position={[0, 0.5, 3]} intensity={0.5} color="#ffffff" distance={8} />

        <Environment preset="night" />

        <StaticCar />

        <Grid
          args={[20, 20]}
          position={[0, -0.5, 0]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#333"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#555"
          fadeDistance={20}
          fadeStrength={1}
          infiniteGrid
        />

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial opacity={0.4} />
        </mesh>

        <OrbitControls
          target={[0, 0.1, 0]}
          minDistance={2}
          maxDistance={15}
          maxPolarAngle={Math.PI / 2 - 0.05}
          enableDamping
          dampingFactor={0.08}
        />

        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport labelColor="white" axisHeadScale={0.8} />
        </GizmoHelper>
      </Canvas>
    </div>
  )
}
