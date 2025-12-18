import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useDistanceGridStore } from '../../../stores/useDistanceGridStore'

const GRID_SIZE = 1000 // Same as ground plane (doubled)
const GRID_INTERVAL = 50 // meters between lines
const GRID_DIVISIONS = GRID_SIZE / GRID_INTERVAL // 20 divisions

export default function DistanceGridOverlay() {
  const isVisible = useDistanceGridStore(s => s.isVisible)
  const gridRef = useRef<THREE.GridHelper>(null)

  // Fade in/out effect
  useFrame(() => {
    if (!gridRef.current) return
    const material = gridRef.current.material as THREE.LineBasicMaterial
    if (Array.isArray(material)) return

    const targetOpacity = isVisible ? 0.5 : 0
    material.opacity += (targetOpacity - material.opacity) * 0.1
    gridRef.current.visible = material.opacity > 0.01
  })

  return (
    <gridHelper
      ref={gridRef}
      args={[GRID_SIZE, GRID_DIVISIONS, '#ff0000', '#00ff33']}
      position={[0, 0.05, 0]}
      material-transparent={true}
      material-opacity={0.5}
      material-depthWrite={false}
    />
  )
}
