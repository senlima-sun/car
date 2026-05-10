import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { skyDomeVertex, skyDomeFragment } from '@/shaders/skyDome'
import { computeSunDirection, getSunIntensity } from './sunDirection'

export default function SkyDome() {
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uSunIntensity: { value: 1.0 },
      uTurbidity: { value: 2.5 },
      uRayleighStrength: { value: 1.0 },
      uMieStrength: { value: 1.0 },
      uExposure: { value: 1.0 },
      uGroundColor: { value: new THREE.Color(0.18, 0.2, 0.22) },
    }),
    [],
  )

  const pollAcc = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current) return
    pollAcc.current += delta
    if (pollAcc.current < 0.1) return
    pollAcc.current = 0

    const { timeOfDay, rainIntensity } = useEnvironmentStore.getState()
    const sun = computeSunDirection(timeOfDay)
    const u = matRef.current.uniforms
    ;(u.uSunDirection.value as THREE.Vector3).set(sun.x, sun.y, sun.z)
    u.uSunIntensity.value = getSunIntensity(timeOfDay)

    const targetTurbidity = 2.5 + rainIntensity * 5
    const targetRayleigh = 1.0 - rainIntensity * 0.4
    const targetMie = 1.0 + rainIntensity * 0.5

    const lerpFactor = Math.min(1, delta * 1.5)
    u.uTurbidity.value += (targetTurbidity - u.uTurbidity.value) * lerpFactor
    u.uRayleighStrength.value += (targetRayleigh - u.uRayleighStrength.value) * lerpFactor
    u.uMieStrength.value += (targetMie - u.uMieStrength.value) * lerpFactor
  })

  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={skyDomeVertex}
        fragmentShader={skyDomeFragment}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  )
}
