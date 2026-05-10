import { useRef, useMemo } from 'react'
import { Group, DirectionalLight, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { lerp, computeAtmosphereFromDynamic } from './atmosphere'
import { computeSunDirection, getSunIntensity } from './sunDirection'

function lerpColor(from: string, to: string, t: number): string {
  const fromR = parseInt(from.slice(1, 3), 16)
  const fromG = parseInt(from.slice(3, 5), 16)
  const fromB = parseInt(from.slice(5, 7), 16)

  const toR = parseInt(to.slice(1, 3), 16)
  const toG = parseInt(to.slice(3, 5), 16)
  const toB = parseInt(to.slice(5, 7), 16)

  const r = Math.round(lerp(fromR, toR, t))
  const g = Math.round(lerp(fromG, toG, t))
  const b = Math.round(lerp(fromB, toB, t))

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

interface DynamicLightingProps {
  target?: React.RefObject<Group | null>
}

export default function DynamicLighting({ target }: DynamicLightingProps) {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const sunLightRef = useRef<DirectionalLight>(null)
  const worldPos = useRef(new Vector3())

  const config = useMemo(() => {
    return computeAtmosphereFromDynamic(temperature, rainIntensity)
  }, [temperature, rainIntensity])

  useFrame(() => {
    if (!sunLightRef.current || !target?.current) return

    target.current.getWorldPosition(worldPos.current)
    const carPos = worldPos.current
    const { timeOfDay } = useEnvironmentStore.getState()
    const sun = computeSunDirection(timeOfDay)
    const distance = 100

    if (sun.y > 0.05) {
      sunLightRef.current.position.set(
        carPos.x + sun.x * distance,
        sun.y * distance,
        carPos.z + sun.z * distance,
      )
    } else {
      sunLightRef.current.position.set(carPos.x, 50, carPos.z)
    }
    const sunIntensity = getSunIntensity(timeOfDay)
    sunLightRef.current.intensity = config.sunIntensity * (0.3 + 0.7 * sunIntensity)
    sunLightRef.current.target.position.set(carPos.x, 0, carPos.z)
    sunLightRef.current.target.updateMatrixWorld()
  })

  const shadowSize = 512

  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />

      <directionalLight
        ref={sunLightRef}
        position={config.sunPosition}
        intensity={config.sunIntensity}
        color={config.sunColor}
        castShadow={false}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.001}
      />

      <hemisphereLight
        args={[config.hemisphereSkyColor, config.hemisphereGroundColor, config.hemisphereIntensity]}
      />
    </>
  )
}

export { lerpColor }
