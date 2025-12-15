import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'
import type { PlacedObject } from '../../../stores/useCustomizationStore'
import { OBJECT_CONFIGS } from '../../../constants/trackObjects'

interface SelectionHighlightProps {
  object: PlacedObject
}

export default function SelectionHighlight({ object }: SelectionHighlightProps) {
  const ringRef = useRef<Mesh>(null)

  // Animate the ring
  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 2
    }
  })

  // Calculate size based on object type
  const getHighlightSize = (): number => {
    switch (object.type) {
      case 'cone':
        return 1.5
      case 'ramp':
        return (
          Math.max(OBJECT_CONFIGS.ramp.defaultSize.width, OBJECT_CONFIGS.ramp.defaultSize.depth) /
            2 +
          1
        )
      case 'checkpoint':
      case 'road':
      case 'barrier':
        // For linear objects, calculate based on length
        if (object.startPoint && object.endPoint) {
          const dx = object.endPoint[0] - object.startPoint[0]
          const dz = object.endPoint[2] - object.startPoint[2]
          const length = Math.sqrt(dx * dx + dz * dz)
          return Math.max(length / 2 + 2, 4)
        }
        return 4
      default:
        return 2
    }
  }

  const size = getHighlightSize()

  // For linear objects, position at center
  let highlightPosition: [number, number, number] = object.position

  return (
    <group position={highlightPosition}>
      {/* Animated ring indicator */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[size - 0.3, size, 32]} />
        <meshBasicMaterial color='#ff4444' transparent opacity={0.7} side={2} />
      </mesh>

      {/* Inner pulsing circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[size - 0.5, 32]} />
        <meshBasicMaterial color='#ff0000' transparent opacity={0.15} side={2} />
      </mesh>

      {/* Corner markers for better visibility */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i * Math.PI) / 2
        const x = Math.cos(angle) * (size - 0.5)
        const z = Math.sin(angle) * (size - 0.5)
        return (
          <mesh key={i} position={[x, 0.15, z]} rotation={[-Math.PI / 2, 0, angle]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshBasicMaterial color='#ff0000' transparent opacity={0.9} side={2} />
          </mesh>
        )
      })}
    </group>
  )
}
