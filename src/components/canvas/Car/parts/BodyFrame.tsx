import { MutableRefObject, useMemo } from 'react'
import * as THREE from 'three'
import {
  CAR_COLORS,
  getBodyMaterial,
  getAccentMaterial,
} from '../constants/materials'
import { LIVERY, CARBON_FIBER, TITANIUM_MATERIAL } from '../../../../constants/f1Livery'
import {
  createMonocoqueProfile,
  createNoseConeGeometry,
  createSidepodProfile,
  createFloorGeometry,
  createHaloCurve,
  createHaloCenterStrut,
  createBargeboardGeometry,
  createEngineCoverProfile,
  createAirboxGeometry,
} from '../../../../utils/f1Geometry'
import { SuspensionLinkageGroup } from './SuspensionLinkage'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

interface BodyFrameProps {
  isRaining: boolean
  isThermalView: boolean
  engineThermalMaterial: THREE.ShaderMaterial
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function BodyFrame({ isRaining, isThermalView, engineThermalMaterial, suspensionRef }: BodyFrameProps) {
  const bodyMat = getBodyMaterial(isRaining)
  const accentMat = getAccentMaterial(isRaining)


  const monocoqueGeo = useMemo(() => {
    const profile = createMonocoqueProfile()
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 3,
    }
    const geo = new THREE.ExtrudeGeometry(profile, extrudeSettings)
    geo.center()
    return geo
  }, [])

  const noseConeGeo = useMemo(() => createNoseConeGeometry(), [])

  const sidepodGeo = useMemo(() => {
    const profile = createSidepodProfile()
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 1.3,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
    }
    const geo = new THREE.ExtrudeGeometry(profile, extrudeSettings)
    geo.translate(0, 0, -0.65)
    return geo
  }, [])

  const floorGeo = useMemo(() => createFloorGeometry(), [])

  const haloTopGeo = useMemo(() => {
    const curve = createHaloCurve()
    return new THREE.TubeGeometry(curve, 24, 0.018, 8, false)
  }, [])

  const haloCenterGeo = useMemo(() => {
    const curve = createHaloCenterStrut()
    return new THREE.TubeGeometry(curve, 16, 0.016, 8, false)
  }, [])

  const bargeboardGeo = useMemo(() => createBargeboardGeometry(0.15, 0.25), [])

  const engineCoverGeo = useMemo(() => {
    const profile = createEngineCoverProfile()
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 1.6,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.008,
      bevelSegments: 2,
    }
    const geo = new THREE.ExtrudeGeometry(profile, extrudeSettings)
    geo.translate(0, 0, -0.8)
    return geo
  }, [])

  const airboxGeo = useMemo(() => createAirboxGeometry(), [])

  return (
    <group>
      {/* Monocoque */}
      <mesh castShadow receiveShadow geometry={monocoqueGeo} rotation={[0, Math.PI / 2, 0]} position={[0, 0.08, 0.2]}>
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} />
      </mesh>

      {/* Nose cone */}
      <mesh castShadow geometry={noseConeGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.08, 2.4]}>
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} />
      </mesh>

      {/* Nose cone tip fairing */}
      <mesh castShadow position={[0, -0.06, 2.68]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} />
      </mesh>

      {/* Left sidepod */}
      <mesh castShadow receiveShadow geometry={sidepodGeo} position={[0.42, -0.08, 0.35]}>
        <meshStandardMaterial color={LIVERY.PRIMARY_LIGHT} {...bodyMat} />
      </mesh>

      {/* Right sidepod */}
      <mesh castShadow receiveShadow geometry={sidepodGeo} position={[-0.42, -0.08, 0.35]} scale={[-1, 1, 1]}>
        <meshStandardMaterial color={LIVERY.PRIMARY_LIGHT} {...bodyMat} />
      </mesh>

      {/* Left sidepod intake */}
      <mesh castShadow position={[0.50, 0.12, 0.55]}>
        <boxGeometry args={[0.08, 0.24, 0.16]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Right sidepod intake */}
      <mesh castShadow position={[-0.50, 0.12, 0.55]}>
        <boxGeometry args={[0.08, 0.24, 0.16]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Sidepod intake openings (dark) */}
      <mesh position={[0.51, 0.12, 0.64]}>
        <boxGeometry args={[0.06, 0.18, 0.01]} />
        <meshStandardMaterial color='#000000' roughness={1} metalness={0} />
      </mesh>
      <mesh position={[-0.51, 0.12, 0.64]}>
        <boxGeometry args={[0.06, 0.18, 0.01]} />
        <meshStandardMaterial color='#000000' roughness={1} metalness={0} />
      </mesh>

      {/* Floor + diffuser */}
      <mesh receiveShadow geometry={floorGeo} position={[0, -0.16, 0]}>
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} side={THREE.DoubleSide} />
      </mesh>

      {/* Engine cover (curved profile) */}
      <mesh castShadow geometry={engineCoverGeo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.12, 0.0]}>
        {isThermalView ? (
          <primitive object={engineThermalMaterial} attach='material' />
        ) : (
          <meshStandardMaterial color={LIVERY.PRIMARY} {...bodyMat} />
        )}
      </mesh>

      {/* Engine cover spine ridge */}
      <mesh castShadow position={[0, 0.22, -0.55]} rotation={[-0.04, 0, 0]}>
        <boxGeometry args={[0.10, 0.03, 1.1]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Airbox / roll hoop (sculpted) */}
      <mesh castShadow geometry={airboxGeo} position={[0, 0.26, 0.05]}>
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Airbox intake opening */}
      <mesh position={[0, 0.38, 0.28]}>
        <boxGeometry args={[0.13, 0.10, 0.02]} />
        <meshStandardMaterial color='#000000' roughness={1} metalness={0} />
      </mesh>

      {/* Halo - top arch */}
      <mesh castShadow geometry={haloTopGeo}>
        <meshStandardMaterial color={CAR_COLORS.titanium} {...TITANIUM_MATERIAL} />
      </mesh>

      {/* Halo - center strut */}
      <mesh castShadow geometry={haloCenterGeo}>
        <meshStandardMaterial color={CAR_COLORS.titanium} {...TITANIUM_MATERIAL} />
      </mesh>

      {/* Left bargeboard (3 fins) */}
      <group position={[0.55, -0.06, 1.2]} rotation={[0, 0.15, 0.1]}>
        <mesh castShadow geometry={bargeboardGeo}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
        <mesh castShadow geometry={bargeboardGeo} position={[0, 0, 0.06]}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
        <mesh castShadow geometry={bargeboardGeo} position={[0, 0, 0.12]}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
      </group>

      {/* Right bargeboard (3 fins) */}
      <group position={[-0.55, -0.06, 1.2]} rotation={[0, -0.15, -0.1]} scale={[-1, 1, 1]}>
        <mesh castShadow geometry={bargeboardGeo}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
        <mesh castShadow geometry={bargeboardGeo} position={[0, 0, 0.06]}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
        <mesh castShadow geometry={bargeboardGeo} position={[0, 0, 0.12]}>
          <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
        </mesh>
      </group>

      {/* Left wake board */}
      <mesh castShadow position={[0.66, 0.0, 1.35]} rotation={[0, 0.05, 0.15]}>
        <boxGeometry args={[0.005, 0.20, 0.32]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Right wake board */}
      <mesh castShadow position={[-0.66, 0.0, 1.35]} rotation={[0, -0.05, -0.15]}>
        <boxGeometry args={[0.005, 0.20, 0.32]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* === Accent Stripes === */}

      {/* Red band on nose top */}
      <mesh position={[0, 0.04, 2.15]}>
        <boxGeometry args={[0.40, 0.008, 0.40]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} {...accentMat} />
      </mesh>

      {/* Red stripe on left sidepod */}
      <mesh position={[0.49, 0.08, -0.05]}>
        <boxGeometry args={[0.008, 0.06, 1.1]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} {...accentMat} />
      </mesh>

      {/* Red stripe on right sidepod */}
      <mesh position={[-0.49, 0.08, -0.05]}>
        <boxGeometry args={[0.008, 0.06, 1.1]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} {...accentMat} />
      </mesh>

      {/* Yellow line on engine cover spine */}
      <mesh position={[0, 0.24, -0.85]}>
        <boxGeometry args={[0.035, 0.008, 0.9]} />
        <meshStandardMaterial color={LIVERY.ACCENT_YELLOW} {...accentMat} />
      </mesh>

      {/* Yellow stripe under nose */}
      <mesh position={[0, -0.13, 2.05]}>
        <boxGeometry args={[0.24, 0.008, 0.65]} />
        <meshStandardMaterial color={LIVERY.ACCENT_YELLOW} {...accentMat} />
      </mesh>

      {/* Red accent on airbox */}
      <mesh position={[0, 0.46, 0.14]}>
        <boxGeometry args={[0.06, 0.008, 0.12]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} {...accentMat} />
      </mesh>

      {/* === Rear Structure === */}

      {/* Rear crash structure */}
      <mesh castShadow position={[0, -0.04, -2.1]}>
        <boxGeometry args={[0.20, 0.12, 0.30]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Rear light */}
      <mesh position={[0, -0.02, -2.28]}>
        <boxGeometry args={[0.18, 0.04, 0.02]} />
        <meshStandardMaterial color={LIVERY.ACCENT_RED} emissive={LIVERY.ACCENT_RED} emissiveIntensity={0.6} {...accentMat} />
      </mesh>

      {/* Rear diffuser side fences */}
      <mesh castShadow position={[0.55, 0.08, -1.85]}>
        <boxGeometry args={[0.005, 0.25, 0.6]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>
      <mesh castShadow position={[-0.55, 0.08, -1.85]}>
        <boxGeometry args={[0.005, 0.25, 0.6]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>
      <mesh castShadow position={[0.25, 0.06, -1.85]}>
        <boxGeometry args={[0.004, 0.20, 0.55]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>
      <mesh castShadow position={[-0.25, 0.06, -1.85]}>
        <boxGeometry args={[0.004, 0.20, 0.55]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      {/* Sidepod trailing edge vanes */}
      <mesh castShadow position={[0.38, 0.0, -0.6]} rotation={[0, 0.08, 0.05]}>
        <boxGeometry args={[0.004, 0.10, 0.35]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>
      <mesh castShadow position={[-0.38, 0.0, -0.6]} rotation={[0, -0.08, -0.05]}>
        <boxGeometry args={[0.004, 0.10, 0.35]} />
        <meshStandardMaterial color={LIVERY.CARBON} {...CARBON_FIBER} />
      </mesh>

      <SuspensionLinkageGroup isRaining={isRaining} suspensionRef={suspensionRef} />
    </group>
  )
}
