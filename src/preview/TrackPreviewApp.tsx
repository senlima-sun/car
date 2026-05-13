import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { PRESET_TRACKS, getPresetTrack } from '../constants/tracks'
import TrackPreviewScene from './TrackPreviewScene'
import LayerTogglePanel from './LayerTogglePanel'

function readTrackIdFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get('track')
}

export default function TrackPreviewApp() {
  const trackId = useMemo(readTrackIdFromUrl, [])
  const track = useMemo(() => (trackId ? getPresetTrack(trackId) : undefined), [trackId])

  if (!track) {
    return <FallbackList reason={trackId ? `Unknown track: ${trackId}` : 'No track selected'} />
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', position: 'relative' }}>
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
        <Suspense fallback={null}>
          <Physics paused>
            <TrackPreviewScene track={track} />
          </Physics>
        </Suspense>
      </Canvas>
      <LayerTogglePanel trackName={track.name ?? track.id} />
    </div>
  )
}

function FallbackList({ reason }: { reason: string }) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#1a1a2e',
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 16 }}>{reason}</div>
      <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 12 }}>Open one of the presets:</div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          columns: 3,
          columnGap: 36,
          margin: 0,
          width: 'min(720px, 90vw)',
        }}
      >
        {PRESET_TRACKS.map(p => (
          <li key={p.id} style={{ margin: '4px 0' }}>
            <a
              href={`/track-preview?track=${p.id}`}
              style={{ color: '#9cf', textDecoration: 'none' }}
            >
              {p.name ?? p.id}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
