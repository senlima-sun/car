import {
  getRoadCenterPositionAt,
  type RoadSurfaceHitResult,
} from '@/stores/useCustomizationStore'

type PartialDeleteState = {
  road: Parameters<typeof getRoadCenterPositionAt>[0]
  startT: number
  startPosition: [number, number, number]
}

export function PartialDeletePreview({
  partialDeleteState,
  partialDeletePreviewT,
  partialDeleteHover,
}: {
  partialDeleteState: PartialDeleteState | null
  partialDeletePreviewT: number | null
  partialDeleteHover: RoadSurfaceHitResult | null
}) {
  if (partialDeleteState && partialDeletePreviewT !== null) {
    const road = partialDeleteState.road
    const startT = Math.min(partialDeleteState.startT, partialDeletePreviewT)
    const endT = Math.max(partialDeleteState.startT, partialDeletePreviewT)

    const startPos = getRoadCenterPositionAt(road, startT)
    const endPos = getRoadCenterPositionAt(road, endT)

    const numSamples = 8
    const deleteZoneMarkers = []
    for (let i = 0; i <= numSamples; i++) {
      const t = startT + (endT - startT) * (i / numSamples)
      const pos = getRoadCenterPositionAt(road, t)
      deleteZoneMarkers.push(
        <mesh key={`delete-marker-${i}`} position={[pos[0], pos[1] + 0.15, pos[2]]}>
          <sphereGeometry args={[0.4, 8, 8]} />
          <meshStandardMaterial color='#ff0000' transparent opacity={0.6} />
        </mesh>,
      )
    }

    return (
      <>
        <mesh
          position={[
            partialDeleteState.startPosition[0],
            partialDeleteState.startPosition[1] + 0.4,
            partialDeleteState.startPosition[2],
          ]}
        >
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshStandardMaterial
            color='#ff0000'
            transparent
            opacity={0.9}
            emissive='#ff0000'
            emissiveIntensity={0.3}
          />
        </mesh>

        <mesh position={[endPos[0], endPos[1] + 0.35, endPos[2]]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial
            color='#ff4444'
            transparent
            opacity={0.8}
            emissive='#ff4444'
            emissiveIntensity={0.2}
          />
        </mesh>

        {deleteZoneMarkers}

        <mesh
          position={[
            (startPos[0] + endPos[0]) / 2,
            (startPos[1] + endPos[1]) / 2 + 0.08,
            (startPos[2] + endPos[2]) / 2,
          ]}
          rotation={[
            -Math.PI / 2,
            0,
            Math.atan2(endPos[0] - startPos[0], endPos[2] - startPos[2]),
          ]}
        >
          <planeGeometry
            args={[
              16,
              Math.sqrt(
                Math.pow(endPos[0] - startPos[0], 2) + Math.pow(endPos[2] - startPos[2], 2),
              ),
            ]}
          />
          <meshBasicMaterial color='#ff0000' transparent opacity={0.25} side={2} depthWrite={false} />
        </mesh>
      </>
    )
  }

  if (partialDeleteHover) {
    return (
      <>
        <mesh
          position={[
            partialDeleteHover.centerPosition[0],
            partialDeleteHover.centerPosition[1] + 0.25,
            partialDeleteHover.centerPosition[2],
          ]}
        >
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial
            color='#ff6600'
            transparent
            opacity={0.85}
            emissive='#ff6600'
            emissiveIntensity={0.2}
          />
        </mesh>
        <mesh
          position={[
            partialDeleteHover.centerPosition[0],
            partialDeleteHover.centerPosition[1] + 0.05,
            partialDeleteHover.centerPosition[2],
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[1.0, 1.3, 16]} />
          <meshBasicMaterial color='#ff6600' transparent opacity={0.6} side={2} />
        </mesh>
      </>
    )
  }

  return null
}
