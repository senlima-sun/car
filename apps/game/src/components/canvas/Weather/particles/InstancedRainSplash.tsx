import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'

const SPLASH_COUNT = 450
const AREA_SIZE = 70
const MAX_LIFE = 0.5
const MAX_RADIUS = 0.7

interface Splash {
  x: number
  z: number
  age: number
  life: number
}

const ringVertexShader = `
attribute float aAge;
attribute float aLife;
varying float vAlpha;
varying vec2 vUv;

void main() {
  vUv = uv;
  float t = clamp(aAge / max(aLife, 0.0001), 0.0, 1.0);
  float scale = mix(0.15, 1.0, t);
  vec3 pos = position * scale;
  vAlpha = (1.0 - t) * step(0.0, aLife - aAge);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
}
`

const ringFragmentShader = `
varying float vAlpha;
varying vec2 vUv;

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float ring = smoothstep(0.45, 0.78, r) * (1.0 - smoothstep(0.85, 1.05, r));
  float inner = (1.0 - smoothstep(0.0, 0.35, r)) * 0.4;
  float alpha = (ring * 1.3 + inner) * vAlpha;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(0.9, 0.95, 1.0, alpha);
}
`

export function InstancedRainSplash() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const { camera } = useThree()

  const splashesRef = useRef<Splash[]>(
    Array.from({ length: SPLASH_COUNT }, () => ({ x: 0, z: 0, age: 0, life: 0 })),
  )

  const { geometry, material, ageAttr, lifeAttr } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(MAX_RADIUS * 2, MAX_RADIUS * 2)
    geom.rotateX(-Math.PI / 2)

    const ages = new Float32Array(SPLASH_COUNT)
    const lifes = new Float32Array(SPLASH_COUNT)
    const ageAttr = new THREE.InstancedBufferAttribute(ages, 1)
    const lifeAttr = new THREE.InstancedBufferAttribute(lifes, 1)
    ageAttr.setUsage(THREE.DynamicDrawUsage)
    lifeAttr.setUsage(THREE.DynamicDrawUsage)
    geom.setAttribute('aAge', ageAttr)
    geom.setAttribute('aLife', lifeAttr)

    const mat = new THREE.ShaderMaterial({
      vertexShader: ringVertexShader,
      fragmentShader: ringFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    return { geometry: geom, material: mat, ageAttr, lifeAttr }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    const splashes = splashesRef.current
    const dummy = dummyRef.current
    const intensity = useEnvironmentStore.getState().rainIntensity
    const mult = usePerformanceStore.getState().particleMultiplier
    const spawnRate = 380 * mult * intensity
    let toSpawn = Math.floor(spawnRate * delta + Math.random())

    const ages = ageAttr.array as Float32Array
    const lifes = lifeAttr.array as Float32Array

    for (let i = 0; i < SPLASH_COUNT; i++) {
      const s = splashes[i]
      s.age += delta

      if (s.age >= s.life) {
        if (toSpawn > 0) {
          toSpawn--
          s.x = camera.position.x + (Math.random() - 0.5) * AREA_SIZE
          s.z = camera.position.z + (Math.random() - 0.5) * AREA_SIZE
          s.age = 0
          s.life = MAX_LIFE * (0.7 + Math.random() * 0.4)
          dummy.position.set(s.x, 0.02, s.z)
          dummy.rotation.set(0, 0, 0)
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          meshRef.current.setMatrixAt(i, dummy.matrix)
        } else {
          s.life = 0
        }
      }

      ages[i] = s.age
      lifes[i] = s.life
    }

    ageAttr.needsUpdate = true
    lifeAttr.needsUpdate = true
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, SPLASH_COUNT]}
      frustumCulled={false}
    />
  )
}
