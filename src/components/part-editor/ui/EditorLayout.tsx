import type { ReactNode } from 'react'
import EditorToolbar from './EditorToolbar'
import ShapePalette from './ShapePalette'
import PartListPanel from './PartListPanel'
import PropertiesPanel from './PropertiesPanel'

interface EditorLayoutProps {
  children: ReactNode
}

const panelStyle: React.CSSProperties = {
  background: '#252538',
  borderRadius: '8px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

export default function EditorLayout({ children }: EditorLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top toolbar */}
      <EditorToolbar />

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, gap: '8px', padding: '8px', overflow: 'hidden' }}>
        {/* Left panel */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={panelStyle}>
            <ShapePalette />
          </div>
          <div style={{ ...panelStyle, flex: 1, overflow: 'auto' }}>
            <PartListPanel />
          </div>
        </div>

        {/* Center viewport */}
        <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden' }}>
          {children}
        </div>

        {/* Right panel */}
        <div style={{ width: '260px' }}>
          <div style={{ ...panelStyle, height: '100%', overflow: 'auto' }}>
            <PropertiesPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
