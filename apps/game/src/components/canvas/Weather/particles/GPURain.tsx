import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rainVertexShader, rainFragmentShader } from '../../../../shaders/rainParticles'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'

export function GPURain() {
  const pointsRef = useRef<THREE.Points>(null)
  const { camera } = useThree()

  const dropCount = 800
  const areaSize = 150

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(dropCount * 3)
    const velocities = new Float32Array(dropCount)
    const basePositions = new Float32Array(dropCount * 3)
    const phases = new Float32Array(dropCount)

    for (let i = 0; i < dropCount; i++) {
      const x = (Math.random() - 0.5) * areaSize
      const y = Math.random() * 80
      const z = (Math.random() - 0.5) * areaSize

      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      velocities[i] = 35 + Math.random() * 25
      phases[i] = Math.random() * 10
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1))
    geometry.setAttribute('basePosition', new THREE.BufferAttribute(basePositions, 3))
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uAreaSize: { value: areaSize },
        uOpacity: { value: 0.4 },
      },
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry, material }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(state => {
    if (!pointsRef.current) return

    const mult = usePerformanceStore.getState().particleMultiplier
    const activeCount = Math.ceil(dropCount * mult)

    if (pointsRef.current.geometry.drawRange.count !== activeCount) {
      pointsRef.current.geometry.setDrawRange(0, activeCount)
    }

    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uCameraPosition.value.copy(camera.position)
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}
