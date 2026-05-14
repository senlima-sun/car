import { useMemo, useState, useEffect } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import { useGameStore } from '../../../stores/useGameStore'
import { validateTrack, type TrackValidationReport } from '../../../utils/trackValidation'

export default function ValidationOverlay() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const graph = useTrackGraphStore(s => s.graph)
  const isCustomizeMode = useGameStore(s => s.status) === 'customize'
  const [report, setReport] = useState<TrackValidationReport | null>(null)

  useEffect(() => {
    if (!isCustomizeMode) {
      setReport(null)
      return
    }
    const result = validateTrack(placedObjects, graph)
    setReport(result)
  }, [placedObjects, graph, isCustomizeMode])

  const gapMarkers = useMemo(() => {
    if (!report) return []
    return report.results
      .filter(r => r.severity !== 'pass' && r.location)
      .map(r => ({ position: r.location!, severity: r.severity, id: r.id }))
  }, [report])

  if (!isCustomizeMode || gapMarkers.length === 0) return null

  return (
    <group>
      {gapMarkers.map(marker => (
        <group key={marker.id} position={marker.position}>
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[0.8, 16, 16]} />
            <meshStandardMaterial
              color={marker.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              emissive={marker.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              emissiveIntensity={0.8}
              transparent
              opacity={0.7}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 2, 32]} />
            <meshStandardMaterial
              color={marker.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              emissive={marker.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              emissiveIntensity={0.5}
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
