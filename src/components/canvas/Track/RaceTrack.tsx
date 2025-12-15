import { useMemo, type JSX } from 'react'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

const TRACK_WIDTH = 14

// Enhanced grass textures with normal and displacement maps
function createGrassTextures(): {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  displacementMap: THREE.CanvasTexture
} {
  const size = 512

  // Color map - varied green grass with blade patterns
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = size
  colorCanvas.height = size
  const colorCtx = colorCanvas.getContext('2d')!

  // Base grass color gradient
  const gradient = colorCtx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, '#3d7a2d')
  gradient.addColorStop(1, '#2d5a1d')
  colorCtx.fillStyle = gradient
  colorCtx.fillRect(0, 0, size, size)

  // Add grass blade patterns
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const hue = 90 + Math.random() * 30 - 15
    const sat = 40 + Math.random() * 30
    const light = 25 + Math.random() * 20
    colorCtx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`

    colorCtx.save()
    colorCtx.translate(x, y)
    colorCtx.rotate(Math.random() * Math.PI)
    colorCtx.fillRect(-1, -3, 2, 6)
    colorCtx.restore()
  }

  // Add occasional brown patches (bare earth)
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const radius = 5 + Math.random() * 15
    colorCtx.fillStyle = 'rgba(80, 60, 40, 0.3)'
    colorCtx.beginPath()
    colorCtx.arc(x, y, radius, 0, Math.PI * 2)
    colorCtx.fill()
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas)
  colorTexture.wrapS = THREE.RepeatWrapping
  colorTexture.wrapT = THREE.RepeatWrapping
  colorTexture.repeat.set(150, 150)

  // Normal map - grass blade directions for depth
  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = size
  normalCanvas.height = size
  const normalCtx = normalCanvas.getContext('2d')!
  normalCtx.fillStyle = '#8080ff' // Neutral up-facing normal
  normalCtx.fillRect(0, 0, size, size)

  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const angle = Math.random() * Math.PI * 2
    const strength = 0.2 + Math.random() * 0.3

    const nx = 128 + Math.cos(angle) * strength * 127
    const ny = 128 + Math.sin(angle) * strength * 127

    normalCtx.fillStyle = `rgb(${Math.floor(nx)}, ${Math.floor(ny)}, 255)`
    normalCtx.save()
    normalCtx.translate(x, y)
    normalCtx.rotate(angle)
    normalCtx.fillRect(-1, -2, 2, 4)
    normalCtx.restore()
  }

  const normalTexture = new THREE.CanvasTexture(normalCanvas)
  normalTexture.wrapS = THREE.RepeatWrapping
  normalTexture.wrapT = THREE.RepeatWrapping
  normalTexture.repeat.set(150, 150)

  // Displacement map - subtle height variation
  const dispCanvas = document.createElement('canvas')
  dispCanvas.width = 256
  dispCanvas.height = 256
  const dispCtx = dispCanvas.getContext('2d')!
  dispCtx.fillStyle = '#808080' // Neutral height
  dispCtx.fillRect(0, 0, 256, 256)

  for (let x = 0; x < 256; x += 4) {
    for (let y = 0; y < 256; y += 4) {
      const value = 128 + (Math.random() - 0.5) * 60
      dispCtx.fillStyle = `rgb(${value}, ${value}, ${value})`
      dispCtx.fillRect(x, y, 4, 4)
    }
  }

  const displacementTexture = new THREE.CanvasTexture(dispCanvas)
  displacementTexture.wrapS = THREE.RepeatWrapping
  displacementTexture.wrapT = THREE.RepeatWrapping
  displacementTexture.repeat.set(150, 150)

  return { map: colorTexture, normalMap: normalTexture, displacementMap: displacementTexture }
}

// Asphalt texture for track surface
function createAsphaltTexture(): {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
} {
  // Base color map - dark gray with aggregate variation
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = 256
  colorCanvas.height = 256
  const colorCtx = colorCanvas.getContext('2d')!

  colorCtx.fillStyle = '#2a2a2a'
  colorCtx.fillRect(0, 0, 256, 256)

  // Add aggregate speckles
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const size = 1 + Math.random() * 2
    const brightness = 30 + Math.floor(Math.random() * 30)
    colorCtx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`
    colorCtx.fillRect(x, y, size, size)
  }

  // Add occasional lighter worn patches
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    colorCtx.fillStyle = 'rgba(60, 60, 60, 0.3)'
    colorCtx.beginPath()
    colorCtx.arc(x, y, 3 + Math.random() * 5, 0, Math.PI * 2)
    colorCtx.fill()
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas)
  colorTexture.wrapS = THREE.RepeatWrapping
  colorTexture.wrapT = THREE.RepeatWrapping

  // Normal map - surface roughness
  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = 256
  normalCanvas.height = 256
  const normalCtx = normalCanvas.getContext('2d')!
  normalCtx.fillStyle = '#8080ff'
  normalCtx.fillRect(0, 0, 256, 256)

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const nx = 128 + (Math.random() - 0.5) * 40
    const ny = 128 + (Math.random() - 0.5) * 40
    normalCtx.fillStyle = `rgb(${Math.floor(nx)}, ${Math.floor(ny)}, 255)`
    normalCtx.fillRect(x, y, 1, 1)
  }

  const normalTexture = new THREE.CanvasTexture(normalCanvas)
  normalTexture.wrapS = THREE.RepeatWrapping
  normalTexture.wrapT = THREE.RepeatWrapping

  // Roughness map
  const roughnessCanvas = document.createElement('canvas')
  roughnessCanvas.width = 128
  roughnessCanvas.height = 128
  const roughnessCtx = roughnessCanvas.getContext('2d')!
  roughnessCtx.fillStyle = '#b3b3b3'
  roughnessCtx.fillRect(0, 0, 128, 128)

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 128
    const y = Math.random() * 128
    const r = 160 + Math.floor(Math.random() * 60)
    roughnessCtx.fillStyle = `rgb(${r}, ${r}, ${r})`
    roughnessCtx.fillRect(x, y, 2, 2)
  }

  const roughnessTexture = new THREE.CanvasTexture(roughnessCanvas)
  roughnessTexture.wrapS = THREE.RepeatWrapping
  roughnessTexture.wrapT = THREE.RepeatWrapping

  return { map: colorTexture, normalMap: normalTexture, roughnessMap: roughnessTexture }
}

// Ground with enhanced textures
function Ground() {
  const textures = useMemo(() => createGrassTextures(), [])

  return (
    <RigidBody type='fixed' friction={0.4}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000, 128, 128]} />
        <meshStandardMaterial
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={new THREE.Vector2(0.5, 0.5)}
          displacementMap={textures.displacementMap}
          displacementScale={0.15}
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
    </RigidBody>
  )
}

// Track segment with asphalt texture
function TrackSegment({
  position,
  rotation = 0,
  length = 50,
}: {
  position: [number, number, number]
  rotation?: number
  length?: number
}) {
  const textures = useMemo(() => {
    const t = createAsphaltTexture()
    const lengthRepeat = (length / 50) * 40
    t.map.repeat.set(8, lengthRepeat)
    t.normalMap.repeat.set(8, lengthRepeat)
    t.roughnessMap.repeat.set(8, lengthRepeat)
    return t
  }, [length])

  return (
    <mesh position={position} rotation={[-Math.PI / 2, rotation, 0]} receiveShadow>
      <planeGeometry args={[TRACK_WIDTH, length]} />
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new THREE.Vector2(0.3, 0.3)}
        roughnessMap={textures.roughnessMap}
        roughness={0.75}
        metalness={0.0}
      />
    </mesh>
  )
}

// Kerb strip
function Kerb({
  position,
  rotation = 0,
  color,
}: {
  position: [number, number, number]
  rotation?: number
  color: string
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[1.5, 4]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// Pylon/cone
function Pylon({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={[position[0], 0.4, position[2]]} castShadow>
      <coneGeometry args={[0.3, 0.8, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// Complete oval track (exported for future use)
export function OvalTrack() {
  const straightLength = 150
  const turnRadius = 50
  const segments: JSX.Element[] = []
  const kerbs: JSX.Element[] = []
  const pylons: JSX.Element[] = []
  const centerLines: JSX.Element[] = []

  // Bottom straight (car starts here at z=0)
  segments.push(<TrackSegment key='s1' position={[0, 0, 0]} length={straightLength} />)

  // Top straight
  segments.push(
    <TrackSegment
      key='s2'
      position={[0, 0, straightLength + turnRadius * 2]}
      length={straightLength}
    />,
  )

  // Right turn (bottom)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI
    const x = Math.sin(angle) * turnRadius
    const z = straightLength / 2 + turnRadius - Math.cos(angle) * turnRadius
    segments.push(
      <TrackSegment key={`rt-${i}`} position={[x, 0, z]} rotation={-angle} length={15} />,
    )
  }

  // Left turn (top)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI
    const x = -Math.sin(angle) * turnRadius
    const z = straightLength / 2 + turnRadius * 3 + Math.cos(angle) * turnRadius
    segments.push(
      <TrackSegment key={`lt-${i}`} position={[x, 0, z]} rotation={angle} length={15} />,
    )
  }

  // Kerbs along bottom straight
  for (let z = -straightLength / 2; z <= straightLength / 2; z += 5) {
    const idx = Math.floor((z + straightLength / 2) / 5)
    const color = idx % 2 === 0 ? '#ff0000' : '#ffffff'
    kerbs.push(<Kerb key={`kb1-${z}`} position={[-TRACK_WIDTH / 2 - 0.8, 0.02, z]} color={color} />)
    kerbs.push(<Kerb key={`kb2-${z}`} position={[TRACK_WIDTH / 2 + 0.8, 0.02, z]} color={color} />)
  }

  // Kerbs along top straight
  const topZ = straightLength + turnRadius * 2
  for (let z = -straightLength / 2; z <= straightLength / 2; z += 5) {
    const idx = Math.floor((z + straightLength / 2) / 5)
    const color = idx % 2 === 0 ? '#ff0000' : '#ffffff'
    kerbs.push(
      <Kerb key={`kt1-${z}`} position={[-TRACK_WIDTH / 2 - 0.8, 0.02, topZ + z]} color={color} />,
    )
    kerbs.push(
      <Kerb key={`kt2-${z}`} position={[TRACK_WIDTH / 2 + 0.8, 0.02, topZ + z]} color={color} />,
    )
  }

  // Kerbs around turns
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI
    const color = i % 2 === 0 ? '#ff0000' : '#ffffff'

    // Right turn kerbs
    const rOuterX = Math.sin(angle) * (turnRadius + TRACK_WIDTH / 2 + 1)
    const rOuterZ =
      straightLength / 2 + turnRadius - Math.cos(angle) * (turnRadius + TRACK_WIDTH / 2 + 1)
    const rInnerX = Math.sin(angle) * (turnRadius - TRACK_WIDTH / 2 - 1)
    const rInnerZ =
      straightLength / 2 + turnRadius - Math.cos(angle) * (turnRadius - TRACK_WIDTH / 2 - 1)
    kerbs.push(
      <Kerb key={`kro-${i}`} position={[rOuterX, 0.02, rOuterZ]} rotation={-angle} color={color} />,
    )
    kerbs.push(
      <Kerb key={`kri-${i}`} position={[rInnerX, 0.02, rInnerZ]} rotation={-angle} color={color} />,
    )

    // Left turn kerbs
    const lOuterX = -Math.sin(angle) * (turnRadius + TRACK_WIDTH / 2 + 1)
    const lOuterZ =
      straightLength / 2 + turnRadius * 3 + Math.cos(angle) * (turnRadius + TRACK_WIDTH / 2 + 1)
    const lInnerX = -Math.sin(angle) * (turnRadius - TRACK_WIDTH / 2 - 1)
    const lInnerZ =
      straightLength / 2 + turnRadius * 3 + Math.cos(angle) * (turnRadius - TRACK_WIDTH / 2 - 1)
    kerbs.push(
      <Kerb key={`klo-${i}`} position={[lOuterX, 0.02, lOuterZ]} rotation={angle} color={color} />,
    )
    kerbs.push(
      <Kerb key={`kli-${i}`} position={[lInnerX, 0.02, lInnerZ]} rotation={angle} color={color} />,
    )
  }

  // Pylons along straights
  for (let z = -straightLength / 2; z <= straightLength / 2; z += 20) {
    const color = z % 40 === 0 ? '#ff6600' : '#ffffff'
    pylons.push(<Pylon key={`pb1-${z}`} position={[-TRACK_WIDTH / 2 - 2.5, 0, z]} color={color} />)
    pylons.push(<Pylon key={`pb2-${z}`} position={[TRACK_WIDTH / 2 + 2.5, 0, z]} color={color} />)
    pylons.push(
      <Pylon key={`pt1-${z}`} position={[-TRACK_WIDTH / 2 - 2.5, 0, topZ + z]} color={color} />,
    )
    pylons.push(
      <Pylon key={`pt2-${z}`} position={[TRACK_WIDTH / 2 + 2.5, 0, topZ + z]} color={color} />,
    )
  }

  // Center line dashes on straights
  for (let z = -straightLength / 2; z <= straightLength / 2; z += 8) {
    centerLines.push(
      <mesh key={`cl1-${z}`} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 4]} />
        <meshBasicMaterial color='#ffffff' />
      </mesh>,
    )
    centerLines.push(
      <mesh key={`cl2-${z}`} position={[0, 0.02, topZ + z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, 4]} />
        <meshBasicMaterial color='#ffffff' />
      </mesh>,
    )
  }

  return (
    <group>
      {segments}
      {kerbs}
      {pylons}
      {centerLines}
    </group>
  )
}

// Start/finish line
function StartLine() {
  const checks = []
  for (let i = 0; i < 14; i++) {
    for (let j = 0; j < 2; j++) {
      if ((i + j) % 2 === 0) {
        checks.push(
          <mesh
            key={`check-${i}-${j}`}
            position={[-TRACK_WIDTH / 2 + i + 0.5, 0.02, j - 0.5]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color='#ffffff' />
          </mesh>,
        )
      }
    }
  }
  return <group>{checks}</group>
}

export default function RaceTrack() {
  return (
    <group>
      <Ground />
    </group>
  )
}

// Export building blocks for custom track creation
export { TrackSegment, Kerb, Pylon, StartLine, TRACK_WIDTH }
