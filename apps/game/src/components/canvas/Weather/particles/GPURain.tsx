import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rainVertexShader, rainFragmentShader } from '../../../../shaders/rainParticles'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'

const DROP_COUNT = 2500
const AREA_SIZE = 130

export function GPURain() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { camera } = useThree()

  const { geometry, material } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1)

    const basePositions = new Float32Array(DROP_COUNT * 3)
    const velocities = new Float32Array(DROP_COUNT)
    const phases = new Float32Array(DROP_COUNT)

    for (let i = 0; i < DROP_COUNT; i++) {
      basePositions[i * 3] = (Math.random() - 0.5) * AREA_SIZE
      basePositions[i * 3 + 1] = Math.random() * 80
      basePositions[i * 3 + 2] = (Math.random() - 0.5) * AREA_SIZE
      velocities[i] = 35 + Math.random() * 25
      phases[i] = Math.random() * 10
    }

    quad.setAttribute(
      'basePosition',
      new THREE.InstancedBufferAttribute(basePositions, 3),
    )
    quad.setAttribute(
      'velocity',
      new THREE.InstancedBufferAttribute(velocities, 1),
    )
    quad.setAttribute(
      'phase',
      new THREE.InstancedBufferAttribute(phases, 1),
    )

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uAreaSize: { value: AREA_SIZE },
        uOpacity: { value: 0.85 },
        uColor: { value: new THREE.Color(0.88, 0.94, 1.0) },
        uStreakLength: { value: 1.1 },
        uStreakWidth: { value: 0.04 },
      },
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    return { geometry: quad, material }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(state => {
    if (!meshRef.current) return

    const mult = usePerformanceStore.getState().particleMultiplier
    const intensity = useEnvironmentStore.getState().rainIntensity
    const activeCount = Math.ceil(DROP_COUNT * mult)

    if (meshRef.current.count !== activeCount) {
      meshRef.current.count = activeCount
    }

    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uCameraPosition.value.copy(camera.position)
    material.uniforms.uOpacity.value = 0.6 + intensity * 0.6
    material.uniforms.uStreakLength.value = 0.7 + intensity * 0.9
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, DROP_COUNT]}
      frustumCulled={false}
    />
  )
}
