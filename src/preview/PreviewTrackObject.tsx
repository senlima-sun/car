import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  buildAsphaltGeometry,
  buildRibbonLayers,
} from '../components/canvas/TrackObjects/geometry/ribbonGeometry'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../constants/trackLayers'
import { resolveParentDerivedLayer } from '../utils/parentDerivedLayer'
import type { PlacedObject } from '../types/trackObjects'

interface PreviewTrackObjectProps {
  object: PlacedObject
  allObjects: readonly PlacedObject[]
}

export default function PreviewTrackObject({ object, allObjects }: PreviewTrackObjectProps) {
  if (object.type === 'track_ribbon') return <PreviewRibbon object={object} />
  if (object.type === 'painted_area') return <PreviewPainted object={object} allObjects={allObjects} />
  if (object.type === 'curb') return <PreviewCurb object={object} allObjects={allObjects} />
  if (object.type === 'edge_line') return <PreviewEdgeLine object={object} allObjects={allObjects} />
  return null
}

function PreviewEdgeLine({
  object,
  allObjects,
}: {
  object: PlacedObject
  allObjects: readonly PlacedObject[]
}) {
  const geometry = useMemo(() => {
    const resolved = resolveParentDerivedLayer(object, { allObjects })
    if (!resolved || resolved.points.length < 2) return null
    const built = buildAsphaltGeometry(resolved.points, resolved.closed, resolved.width)
    return built?.geometry ?? null
  }, [object, allObjects])

  useEffect(
    () => () => {
      geometry?.dispose()
    },
    [geometry],
  )

  if (!geometry) return null
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color='#ffffff'
        roughness={0.5}
        metalness={0}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.factor}
        polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.units}
      />
    </mesh>
  )
}

function PreviewRibbon({ object }: { object: PlacedObject }) {
  const layers = useMemo(() => {
    if (!object.ribbonPoints || object.ribbonPoints.length < 2) return null
    return buildRibbonLayers(object.ribbonPoints, object.ribbonClosed ?? false, object.width ?? 12)
  }, [object.ribbonPoints, object.ribbonClosed, object.width])

  useEffect(
    () => () => {
      layers?.mainGeometry.dispose()
      layers?.pitGeometry?.dispose()
    },
    [layers],
  )

  if (!layers) return null

  const isAllPit = object.ribbonPoints?.every(p => p.isPitLane) ?? false

  return (
    <group>
      <mesh geometry={layers.mainGeometry}>
        <meshStandardMaterial
          color={isAllPit ? '#3a3a3a' : '#4a4a4a'}
          roughness={0.85}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.factor}
          polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.units}
        />
      </mesh>
      {layers.pitGeometry && (
        <mesh geometry={layers.pitGeometry}>
          <meshStandardMaterial
            color='#3a3a3a'
            roughness={0.85}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.factor}
            polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.units}
          />
        </mesh>
      )}
    </group>
  )
}

function PreviewPainted({
  object,
  allObjects,
}: {
  object: PlacedObject
  allObjects: readonly PlacedObject[]
}) {
  const built = useMemo(() => {
    if (object.parentRibbonId) {
      const resolved = resolveParentDerivedLayer(object, { allObjects })
      if (!resolved || resolved.points.length < 2) return null
      return buildAsphaltGeometry(resolved.points, resolved.closed, resolved.width)
    }
    if (!object.ribbonPoints || object.ribbonPoints.length < 2) return null
    return buildAsphaltGeometry(object.ribbonPoints, object.ribbonClosed ?? false, object.width ?? 3)
  }, [object, allObjects])

  useEffect(
    () => () => {
      built?.geometry.dispose()
    },
    [built],
  )

  if (!built || built.mainIndices.length === 0) return null

  return (
    <mesh geometry={built.geometry}>
      <meshStandardMaterial
        color='#a8d89c'
        roughness={0.7}
        metalness={0}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.factor}
        polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.units}
      />
    </mesh>
  )
}

function PreviewCurb({
  object,
  allObjects,
}: {
  object: PlacedObject
  allObjects: readonly PlacedObject[]
}) {
  const built = useMemo(() => {
    if (object.parentRibbonId) {
      const resolved = resolveParentDerivedLayer(object, { allObjects })
      if (!resolved || resolved.points.length < 2) return null
      return buildAsphaltGeometry(resolved.points, resolved.closed, resolved.width)
    }
    if (!object.curbCenterline || object.curbCenterline.length < 2) return null
    return buildAsphaltGeometry(object.curbCenterline, false, 1.5)
  }, [object, allObjects])

  useEffect(
    () => () => {
      built?.geometry.dispose()
    },
    [built],
  )

  if (!built || built.mainIndices.length === 0) return null

  return (
    <mesh geometry={built.geometry}>
      <meshStandardMaterial
        color='#d44d4d'
        roughness={0.6}
        metalness={0}
        polygonOffset
        polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.CURB.factor}
        polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.CURB.units}
      />
    </mesh>
  )
}
