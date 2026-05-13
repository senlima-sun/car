import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { buildAsphaltGeometry, buildRibbonLayers } from '../components/canvas/TrackObjects/geometry/ribbonGeometry'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../constants/trackLayers'
import type { PlacedObject } from '../types/trackObjects'

interface PreviewTrackObjectProps {
  object: PlacedObject
}

export default function PreviewTrackObject({ object }: PreviewTrackObjectProps) {
  if (object.type === 'track_ribbon') return <PreviewRibbon object={object} />
  if (object.type === 'painted_area') return <PreviewPainted object={object} />
  if (object.type === 'curb') return <PreviewCurb object={object} />
  return null
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
      layers?.leftEdgeGeometry?.dispose()
      layers?.rightEdgeGeometry?.dispose()
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
      {layers.leftEdgeGeometry && (
        <mesh geometry={layers.leftEdgeGeometry}>
          <meshStandardMaterial
            color='#ffffff'
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.factor}
            polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.units}
          />
        </mesh>
      )}
      {layers.rightEdgeGeometry && (
        <mesh geometry={layers.rightEdgeGeometry}>
          <meshStandardMaterial
            color='#ffffff'
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.factor}
            polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.units}
          />
        </mesh>
      )}
    </group>
  )
}

function PreviewPainted({ object }: { object: PlacedObject }) {
  const built = useMemo(() => {
    if (!object.ribbonPoints || object.ribbonPoints.length < 2) return null
    return buildAsphaltGeometry(object.ribbonPoints, object.ribbonClosed ?? false, object.width ?? 3)
  }, [object.ribbonPoints, object.ribbonClosed, object.width])

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

function PreviewCurb({ object }: { object: PlacedObject }) {
  const built = useMemo(() => {
    if (!object.curbCenterline || object.curbCenterline.length < 2) return null
    return buildAsphaltGeometry(object.curbCenterline, false, 1.5)
  }, [object.curbCenterline])

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
