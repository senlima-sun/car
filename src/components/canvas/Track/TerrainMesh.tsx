import { useMemo, useRef, useEffect } from 'react'
import { PlaneGeometry, Mesh, ShaderMaterial, Color } from 'three'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useGameStore } from '../../../stores/useGameStore'
import { generateTerrainHeights } from '../../../utils/terrainGenerator'

const GRID_SIZE = 128
const WORLD_SIZE = 200
const FALLOFF_RADIUS = 15
const DEBOUNCE_MS = 500

const terrainVertexShader = `
  varying float vWorldY;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vWorldY = position.y;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const terrainFragmentShader = `
  uniform vec3 baseColor;
  uniform vec3 contourColor;
  uniform float contourSpacing;
  uniform float contourWidth;
  uniform bool showContours;

  varying float vWorldY;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 color = baseColor;

    float slope = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
    color = mix(color, color * 0.7, smoothstep(0.3, 0.8, slope));

    if (showContours && vWorldY > 0.1) {
      float line = abs(fract(vWorldY / contourSpacing + 0.5) - 0.5);
      float contour = 1.0 - smoothstep(0.0, contourWidth, line);
      color = mix(color, contourColor, contour * 0.4);
    }

    float diffuse = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.3))), 0.0);
    color *= 0.3 + 0.7 * diffuse;

    gl_FragColor = vec4(color, 1.0);
  }
`

export default function TerrainMesh() {
  const meshRef = useRef<Mesh>(null)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const status = useGameStore(s => s.status)
  const isCustomizeMode = status === 'customize'
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevHeightsRef = useRef<Float32Array | null>(null)

  const material = useMemo(() => {
    return new ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        baseColor: { value: new Color('#4a7c59') },
        contourColor: { value: new Color('#2d5a3a') },
        contourSpacing: { value: 2.0 },
        contourWidth: { value: 0.03 },
        showContours: { value: isCustomizeMode },
      },
    })
  }, [])

  useEffect(() => {
    material.uniforms.showContours.value = isCustomizeMode
  }, [isCustomizeMode, material])

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE - 1, GRID_SIZE - 1)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(() => {
      const heights = generateTerrainHeights(placedObjects, GRID_SIZE, WORLD_SIZE, FALLOFF_RADIUS)

      const positions = geometry.attributes.position.array as Float32Array
      let hasElevation = false
      for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const h = heights[i]
        positions[i * 3 + 1] = h
        if (h > 0.01) hasElevation = true
      }

      geometry.attributes.position.needsUpdate = true
      geometry.computeVertexNormals()

      if (meshRef.current) {
        meshRef.current.visible = hasElevation
      }

      prevHeightsRef.current = heights
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [placedObjects, geometry])

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, -0.05, 0]}
      receiveShadow
      visible={false}
    />
  )
}
