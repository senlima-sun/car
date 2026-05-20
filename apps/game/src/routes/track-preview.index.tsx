import { createFileRoute, Link } from '@tanstack/react-router'
import { listPresetTracks } from '@/constants/tracks'

function TrackPreviewList() {
  const presets = listPresetTracks()
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#3a5a3a',
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 16 }}>Track Preview</div>
      <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 12 }}>Pick a preset:</div>
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
        {presets.map(p => (
          <li key={p.id} style={{ margin: '4px 0' }}>
            <Link
              to='/track-preview/$presetId'
              params={{ presetId: p.id }}
              style={{ color: '#9cf', textDecoration: 'none' }}
            >
              {p.name ?? p.id}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const Route = createFileRoute('/track-preview/')({
  component: TrackPreviewList,
})
