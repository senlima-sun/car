import { useCallback } from 'react'
import { Text } from '@react-three/drei'
import { ThreeEvent } from '@react-three/fiber'
import { GHOST_OPACITY } from '../../../constants/trackObjects'

const GITHUB_URL = 'https://github.com/senlima-sun/car'

interface TracksideBoardProps {
  position: [number, number, number]
  rotation: number
  isGhost?: boolean
}

export default function TracksideBoard({
  position,
  rotation,
  isGhost = false,
}: TracksideBoardProps) {
  const boardWidth = 4.5
  const boardHeight = 1.8
  const boardDepth = 0.1
  const poleHeight = 3
  const poleRadius = 0.08
  const boardElevation = 2.2

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')
  }, [])

  const handlePointerOver = useCallback(() => {
    document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'auto'
  }, [])

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Left support pole */}
      <mesh position={[-boardWidth / 2 + 0.2, poleHeight / 2, 0]} castShadow={!isGhost}>
        <cylinderGeometry args={[poleRadius, poleRadius, poleHeight, 8]} />
        <meshStandardMaterial
          color='#555555'
          metalness={0.6}
          roughness={0.4}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Right support pole */}
      <mesh position={[boardWidth / 2 - 0.2, poleHeight / 2, 0]} castShadow={!isGhost}>
        <cylinderGeometry args={[poleRadius, poleRadius, poleHeight, 8]} />
        <meshStandardMaterial
          color='#555555'
          metalness={0.6}
          roughness={0.4}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Main billboard panel - clickable */}
      <mesh
        position={[0, boardElevation, 0]}
        castShadow={!isGhost}
        receiveShadow={!isGhost}
        onClick={!isGhost ? handleClick : undefined}
        onPointerOver={!isGhost ? handlePointerOver : undefined}
        onPointerOut={!isGhost ? handlePointerOut : undefined}
      >
        <boxGeometry args={[boardWidth, boardHeight, boardDepth]} />
        <meshStandardMaterial
          color='#1a1a1a'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Green accent border - top */}
      <mesh
        position={[0, boardElevation + boardHeight / 2 - 0.05, boardDepth / 2 + 0.01]}
        castShadow={!isGhost}
      >
        <boxGeometry args={[boardWidth, 0.1, 0.02]} />
        <meshStandardMaterial
          color='#00ff00'
          emissive='#00ff00'
          emissiveIntensity={isGhost ? 0.1 : 0.3}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Green accent border - bottom */}
      <mesh
        position={[0, boardElevation - boardHeight / 2 + 0.05, boardDepth / 2 + 0.01]}
        castShadow={!isGhost}
      >
        <boxGeometry args={[boardWidth, 0.1, 0.02]} />
        <meshStandardMaterial
          color='#00ff00'
          emissive='#00ff00'
          emissiveIntensity={isGhost ? 0.1 : 0.3}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* GitHub text - front side */}
      <Text
        position={[0, boardElevation + 0.3, boardDepth / 2 + 0.02]}
        fontSize={0.35}
        color='#ffffff'
        anchorX='center'
        anchorY='middle'
        fillOpacity={isGhost ? GHOST_OPACITY : 1}
      >
        GITHUB
      </Text>

      {/* URL text - front side */}
      <Text
        position={[0, boardElevation - 0.25, boardDepth / 2 + 0.02]}
        fontSize={0.22}
        color='#00ff00'
        anchorX='center'
        anchorY='middle'
        fillOpacity={isGhost ? GHOST_OPACITY : 1}
      >
        senlima-sun/car
      </Text>

      {/* GitHub text - back side */}
      <Text
        position={[0, boardElevation + 0.3, -boardDepth / 2 - 0.02]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.35}
        color='#ffffff'
        anchorX='center'
        anchorY='middle'
        fillOpacity={isGhost ? GHOST_OPACITY : 1}
      >
        GITHUB
      </Text>

      {/* URL text - back side */}
      <Text
        position={[0, boardElevation - 0.25, -boardDepth / 2 - 0.02]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.22}
        color='#00ff00'
        anchorX='center'
        anchorY='middle'
        fillOpacity={isGhost ? GHOST_OPACITY : 1}
      >
        senlima-sun/car
      </Text>
    </group>
  )
}
