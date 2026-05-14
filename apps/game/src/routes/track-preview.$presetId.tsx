import { createFileRoute, useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { getPresetTrack } from '@/constants/tracks'
import TrackPreviewScene from '@/preview/TrackPreviewScene'
import LayerTogglePanel from '@/preview/LayerTogglePanel'

function TrackPreviewSingle() {
  const { presetId } = useParams({ from: '/track-preview/$presetId' })
  const track = useMemo(() => getPresetTrack(presetId), [presetId])

  if (!track) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#3a5a3a',
          color: '#eee',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Unknown track: {presetId}
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#3a5a3a', position: 'relative' }}>
      <Canvas dpr={[1, 2]}>
        <OrthographicCamera makeDefault position={[0, 200, 0]} zoom={2} near={0.1} far={2000} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, 200, 60]} intensity={0.6} />
        <OrbitControls
          enableRotate={false}
          enablePan
          enableZoom
          minZoom={0.5}
          maxZoom={40}
          mouseButtons={{ LEFT: 2, MIDDLE: 1, RIGHT: 0 }}
        />
        <TrackPreviewScene track={track} />
      </Canvas>
      <LayerTogglePanel trackName={track.name ?? track.id} />
    </div>
  )
}

export const Route = createFileRoute('/track-preview/$presetId')({
  component: TrackPreviewSingle,
})
