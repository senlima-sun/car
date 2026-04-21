import { useMemo, useEffect, useState } from 'react'
import { RigidBody } from '@react-three/rapier'
import { Vector3, TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Texture } from 'three'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import { WALL_HEIGHT, WALL_WIDTH } from '../../../constants/dimensions'
import { TRACK_OBJECT } from '../../../constants/colors'

interface WallProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  adImageUrl?: string
}

const config = OBJECT_CONFIGS.wall

const textureCache = new Map<string, Texture>()
const loader = new TextureLoader()

function useAdTexture(url?: string) {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!url) {
      setTexture(null)
      return
    }

    const cached = textureCache.get(url)
    if (cached) {
      setTexture(cached)
      return
    }

    loader.load(
      url,
      tex => {
        tex.wrapS = RepeatWrapping
        tex.wrapT = RepeatWrapping
        tex.colorSpace = SRGBColorSpace
        textureCache.set(url, tex)
        setTexture(tex)
      },
      undefined,
      () => setTexture(null),
    )
  }, [url])

  return texture
}

export default function Wall({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
  adImageUrl,
}: WallProps) {
  const { length, calculatedRotation, midpoint } = useMemo(() => {
    if (startPoint && endPoint) {
      const start = new Vector3(...startPoint)
      const end = new Vector3(...endPoint)
      const direction = end.clone().sub(start)
      const len = direction.length()
      const rot = Math.atan2(direction.x, direction.z)
      const mid: [number, number, number] = [(start.x + end.x) / 2, 0, (start.z + end.z) / 2]
      return { length: len, calculatedRotation: rot, midpoint: mid }
    }
    return { length: 4, calculatedRotation: rotation, midpoint: position }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  const adTexture = useAdTexture(adImageUrl)

  const adPlane = useMemo(() => {
    if (!adTexture || isGhost) return null

    const img = adTexture.image as { width?: number; height?: number } | undefined
    const aspectRatio = img?.width && img?.height ? img.width / img.height : 1

    const planeHeight = WALL_HEIGHT * 0.8
    const planeWidth = planeHeight * aspectRatio
    const repeatX = Math.max(1, Math.floor(length / planeWidth))

    const clonedTex = adTexture.clone()
    clonedTex.wrapS = RepeatWrapping
    clonedTex.repeat.set(repeatX, 1)
    clonedTex.needsUpdate = true

    return { texture: clonedTex, repeatX }
  }, [adTexture, length, isGhost])

  const mesh = (
    <group position={finalPosition} rotation={[0, finalRotation, 0]}>
      <mesh position={[0, WALL_HEIGHT / 2, 0]} castShadow={!isGhost} receiveShadow={!isGhost}>
        <boxGeometry args={[WALL_WIDTH, WALL_HEIGHT, length]} />
        <meshStandardMaterial
          color={TRACK_OBJECT.wall}
          roughness={0.9}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      <mesh position={[0, WALL_HEIGHT - 0.04, 0]} castShadow={!isGhost}>
        <boxGeometry args={[WALL_WIDTH + 0.04, 0.08, length]} />
        <meshStandardMaterial
          color={TRACK_OBJECT.wallTop}
          roughness={0.85}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {adPlane ? (
        <mesh
          position={[WALL_WIDTH / 2 + 0.005, WALL_HEIGHT / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[length, WALL_HEIGHT * 0.8]} />
          <meshStandardMaterial
            map={adPlane.texture}
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ) : (
        !isGhost && (
          <mesh
            position={[WALL_WIDTH / 2 + 0.005, WALL_HEIGHT / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[length, WALL_HEIGHT * 0.8]} />
            <meshStandardMaterial color='#7a7a7a' roughness={0.95} depthWrite />
          </mesh>
        )
      )}
    </group>
  )

  if (isGhost) return mesh

  return (
    <RigidBody
      type='fixed'
      position={[0, 0, 0]}
      colliders='cuboid'
      friction={config.friction}
      restitution={config.restitution}
    >
      {mesh}
    </RigidBody>
  )
}
