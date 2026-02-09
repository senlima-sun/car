import { useRef, useMemo, MutableRefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { SUSPENSION } from '@/constants/dimensions'
import { computeSuspensionLinkage } from '@/utils/suspensionGeometry'
import { useCarStore } from '@/stores/useCarStore'
import { getMetalMaterial, CAR_COLORS } from '../constants/materials'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'
import type { LinkageTransform } from '@/types/suspension'

const S = SUSPENSION

function applyTransform(
  mesh: THREE.Object3D | null,
  t: LinkageTransform,
) {
  if (!mesh) return
  mesh.position.set(t.position[0], t.position[1], t.position[2])
  mesh.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2])
  if (t.scale) mesh.scale.set(t.scale[0], t.scale[1], t.scale[2])
}

function Wishbone({
  refs,
  tubeRadius,
  isRaining,
}: {
  refs: { armA: React.RefObject<THREE.Mesh | null>; armB: React.RefObject<THREE.Mesh | null> }
  tubeRadius: number
  isRaining: boolean
}) {
  const metalMat = getMetalMaterial(isRaining)
  return (
    <>
      <mesh ref={refs.armA} castShadow>
        <cylinderGeometry args={[tubeRadius, tubeRadius, 1, 8]} />
        <meshStandardMaterial color='#666666' {...metalMat} />
      </mesh>
      <mesh ref={refs.armB} castShadow>
        <cylinderGeometry args={[tubeRadius, tubeRadius, 1, 8]} />
        <meshStandardMaterial color='#666666' {...metalMat} />
      </mesh>
    </>
  )
}

function Upright({ meshRef, isRaining }: { meshRef: React.RefObject<THREE.Mesh | null>; isRaining: boolean }) {
  const metalMat = getMetalMaterial(isRaining)
  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={[S.UPRIGHT_WIDTH, S.UPPER_UPRIGHT_Y - S.LOWER_UPRIGHT_Y, S.UPRIGHT_DEPTH]} />
      <meshStandardMaterial color={CAR_COLORS.metal} {...metalMat} />
    </mesh>
  )
}

function Pushrod({ meshRef, isRaining }: { meshRef: React.RefObject<THREE.Mesh | null>; isRaining: boolean }) {
  const metalMat = getMetalMaterial(isRaining)
  return (
    <mesh ref={meshRef} castShadow>
      <cylinderGeometry args={[S.PUSHROD_RADIUS, S.PUSHROD_RADIUS, 1, 6]} />
      <meshStandardMaterial color='#888888' {...metalMat} />
    </mesh>
  )
}

function Rocker({ meshRef, isRaining }: { meshRef: React.RefObject<THREE.Mesh | null>; isRaining: boolean }) {
  const metalMat = getMetalMaterial(isRaining)
  return (
    <mesh ref={meshRef} castShadow>
      <cylinderGeometry args={[S.ROCKER_RADIUS, S.ROCKER_RADIUS, 1, 6]} />
      <meshStandardMaterial color='#555555' {...metalMat} />
    </mesh>
  )
}

function SpringDamperUnit({
  springRef,
  isRaining,
  isLeft,
}: {
  springRef: React.RefObject<THREE.Group | null>
  isRaining: boolean
  isLeft: boolean
}) {
  const metalMat = getMetalMaterial(isRaining)

  const springGeom = useMemo(() => {
    const points: THREE.Vector3[] = []
    const coils = S.SPRING_COILS
    const height = S.SPRING_REST_LENGTH
    const radius = S.SPRING_RADIUS
    const segments = coils * 16
    const mirror = isLeft ? 1 : -1

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const angle = t * coils * Math.PI * 2
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius * mirror,
        t * height - height / 2,
        Math.sin(angle) * radius,
      ))
    }

    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      segments * 2,
      0.004,
      6,
      false,
    )
  }, [isLeft])

  return (
    <group ref={springRef}>
      <mesh castShadow geometry={springGeom}>
        <meshStandardMaterial color='#cc3333' {...metalMat} />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[S.DAMPER_RADIUS, S.DAMPER_RADIUS, S.DAMPER_BODY_LENGTH, 8]} />
        <meshStandardMaterial color='#333333' {...metalMat} />
      </mesh>
      <mesh castShadow position={[0, (S.DAMPER_BODY_LENGTH + S.DAMPER_SHAFT_LENGTH) / 2, 0]}>
        <cylinderGeometry args={[S.DAMPER_RADIUS * 0.5, S.DAMPER_RADIUS * 0.5, S.DAMPER_SHAFT_LENGTH, 6]} />
        <meshStandardMaterial color='#aaaaaa' {...metalMat} />
      </mesh>
    </group>
  )
}

interface SuspensionCornerProps {
  isLeft: boolean
  isFront: boolean
  isRaining: boolean
  wheelIndex: number
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

function SuspensionCorner({ isLeft, isFront, isRaining, wheelIndex, suspensionRef }: SuspensionCornerProps) {
  const upperArmARef = useRef<THREE.Mesh>(null)
  const upperArmBRef = useRef<THREE.Mesh>(null)
  const lowerArmARef = useRef<THREE.Mesh>(null)
  const lowerArmBRef = useRef<THREE.Mesh>(null)
  const uprightRef = useRef<THREE.Mesh>(null)
  const pushrodRef = useRef<THREE.Mesh>(null)
  const rockerRef = useRef<THREE.Mesh>(null)
  const springRef = useRef<THREE.Group>(null)

  useFrame(() => {
    const deflection = suspensionRef?.current?.wheels[wheelIndex]?.deflection ?? 0
    const steerAngle = isFront ? useCarStore.getState().steerAngle : 0

    const geo = computeSuspensionLinkage(
      deflection,
      steerAngle,
      isLeft,
      isFront,
    )

    applyTransform(upperArmARef.current, geo.upperWishbone.armA)
    applyTransform(upperArmBRef.current, geo.upperWishbone.armB)
    applyTransform(lowerArmARef.current, geo.lowerWishbone.armA)
    applyTransform(lowerArmBRef.current, geo.lowerWishbone.armB)
    applyTransform(uprightRef.current, geo.upright)
    applyTransform(pushrodRef.current, geo.pushrod)
    applyTransform(rockerRef.current, geo.rocker)

    if (springRef.current) {
      const sd = geo.springDamper
      springRef.current.position.set(
        sd.spring.position[0],
        sd.spring.position[1],
        sd.spring.position[2],
      )
      springRef.current.rotation.set(
        sd.spring.rotation[0],
        sd.spring.rotation[1],
        sd.spring.rotation[2],
      )
      const c = sd.spring.compressionRatio
      springRef.current.scale.set(1, c, 1)
    }
  })

  return (
    <>
      <Wishbone
        refs={{ armA: upperArmARef, armB: upperArmBRef }}
        tubeRadius={S.WISHBONE_TUBE_RADIUS}
        isRaining={isRaining}
      />
      <Wishbone
        refs={{ armA: lowerArmARef, armB: lowerArmBRef }}
        tubeRadius={S.WISHBONE_TUBE_RADIUS * 1.1}
        isRaining={isRaining}
      />
      <Upright meshRef={uprightRef} isRaining={isRaining} />
      <Pushrod meshRef={pushrodRef} isRaining={isRaining} />
      <Rocker meshRef={rockerRef} isRaining={isRaining} />
      <SpringDamperUnit springRef={springRef} isRaining={isRaining} isLeft={isLeft} />
    </>
  )
}

interface SuspensionLinkageGroupProps {
  isRaining: boolean
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function SuspensionLinkageGroup({ isRaining, suspensionRef }: SuspensionLinkageGroupProps) {
  return (
    <>
      <SuspensionCorner isLeft isFront isRaining={isRaining} wheelIndex={0} suspensionRef={suspensionRef} />
      <SuspensionCorner isLeft={false} isFront isRaining={isRaining} wheelIndex={1} suspensionRef={suspensionRef} />
      <SuspensionCorner isLeft isFront={false} isRaining={isRaining} wheelIndex={2} suspensionRef={suspensionRef} />
      <SuspensionCorner isLeft={false} isFront={false} isRaining={isRaining} wheelIndex={3} suspensionRef={suspensionRef} />
    </>
  )
}
