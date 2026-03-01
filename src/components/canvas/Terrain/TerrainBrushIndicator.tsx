import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTerrainStore } from '@/stores/useTerrainStore'

const BRUSH_COLORS: Record<string, string> = {
  raise: '#22c55e',
  lower: '#ef4444',
  flatten: '#3b82f6',
  smooth: '#a855f7',
}

const SEGMENTS = 64

export default function TerrainBrushIndicator() {
  const meshRef = useRef<THREE.Mesh>(null)
  const terrainBrushType = useEditorStore(s => s.terrainBrushType)
  const terrainEditMode = useEditorStore(s => s.terrainEditMode)

  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(0.95, 1.0, SEGMENTS)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BRUSH_COLORS[terrainBrushType] || '#ffffff',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [terrainBrushType],
  )

  useFrame(() => {
    if (!meshRef.current || !terrainEditMode) {
      if (meshRef.current) meshRef.current.visible = false
      return
    }

    const previewPos = useEditorStore.getState().previewPosition
    if (!previewPos) {
      meshRef.current.visible = false
      return
    }

    const radius = useEditorStore.getState().terrainBrushRadius
    const y = useTerrainStore.getState().getHeightAt(previewPos[0], previewPos[2])

    meshRef.current.position.set(previewPos[0], y + 0.15, previewPos[2])
    meshRef.current.scale.setScalar(radius)
    meshRef.current.visible = true

    const brushType = useEditorStore.getState().terrainBrushType
    const color = BRUSH_COLORS[brushType] || '#ffffff'
    ;(meshRef.current.material as THREE.MeshBasicMaterial).color.set(color)
  })

  if (!terrainEditMode) return null

  return <mesh ref={meshRef} geometry={geometry} material={material} visible={false} />
}
