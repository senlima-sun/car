import { useRef, useMemo } from 'react'
import { Group, DirectionalLight, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { useGameStore } from '../../../stores/useGameStore'
import { lerp, computeAtmosphereFromDynamic } from './DynamicSky'

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
  const isCustomizeMode = useGameStore(s => s.status) === 'customize'
  const sunLightRef = useRef<DirectionalLight>(null)
  const worldPos = useRef(new Vector3())

  const config = useMemo(() => {
    return computeAtmosphereFromDynamic(temperature, rainIntensity)
  }, [temperature, rainIntensity])

  useFrame(() => {
    if (!sunLightRef.current || !target?.current) return

    target.current.getWorldPosition(worldPos.current)
    const carPos = worldPos.current

    sunLightRef.current.position.set(
      carPos.x + config.sunPosition[0] * 0.5,
      config.sunPosition[1],
      carPos.z + config.sunPosition[2] * 0.5,
    )
    sunLightRef.current.target.position.set(carPos.x, 0, carPos.z)
    sunLightRef.current.target.updateMatrixWorld()
  })

  const shadowSize = 2048

  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />

      <directionalLight
        ref={sunLightRef}
        position={config.sunPosition}
        intensity={config.sunIntensity}
        color={config.sunColor}
        castShadow={!isCustomizeMode}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-bias={-0.0005}
      />

      <directionalLight
        position={[-30, 40, -20]}
        intensity={config.fillLightIntensity}
        color={config.fillLightColor}
      />

      <hemisphereLight
        args={[config.hemisphereSkyColor, config.hemisphereGroundColor, config.hemisphereIntensity]}
      />

      <pointLight
        position={[0, 10, 30]}
        intensity={50 * config.ambientIntensity}
        distance={60}
        color='#ffffff'
      />
    </>
  )
}

export { lerpColor }
