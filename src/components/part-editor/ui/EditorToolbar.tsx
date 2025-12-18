import { useRef } from 'react'
import { usePartEditorStore } from '../store'
import { SNAP_VALUES } from '../constants'
import type { TransformMode } from '../types'

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '8px 16px',
  background: '#252538',
  borderBottom: '1px solid #3a3a50',
}

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '2px',
  background: '#1a1a2e',
  borderRadius: '6px',
  padding: '2px',
}

const buttonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: 'none',
  borderRadius: '4px',
  color: '#aaa',
  cursor: 'pointer',
  fontSize: '12px',
  transition: 'all 0.1s',
}

const activeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#4a4a70',
  color: '#fff',
}

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  background: '#3a3a50',
}

export default function EditorToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const transformMode = usePartEditorStore((s) => s.transformMode)
  const setTransformMode = usePartEditorStore((s) => s.setTransformMode)
  const snapEnabled = usePartEditorStore((s) => s.snapEnabled)
  const setSnapEnabled = usePartEditorStore((s) => s.setSnapEnabled)
  const snapValue = usePartEditorStore((s) => s.snapValue)
  const setSnapValue = usePartEditorStore((s) => s.setSnapValue)
  const canUndo = usePartEditorStore((s) => s.canUndo())
  const canRedo = usePartEditorStore((s) => s.canRedo())
  const undo = usePartEditorStore((s) => s.undo)
  const redo = usePartEditorStore((s) => s.redo)
  const exportConfig = usePartEditorStore((s) => s.exportConfig)
  const importConfig = usePartEditorStore((s) => s.importConfig)
  const configName = usePartEditorStore((s) => s.configName)
  const setConfigName = usePartEditorStore((s) => s.setConfigName)
  const saveToLocalStorage = usePartEditorStore((s) => s.saveToLocalStorage)
  const clearAll = usePartEditorStore((s) => s.clearAll)
  const showReferenceModel = usePartEditorStore((s) => s.showReferenceModel)
  const toggleReferenceModel = usePartEditorStore((s) => s.toggleReferenceModel)

  const modes: { mode: TransformMode; label: string; shortcut: string }[] = [
    { mode: 'translate', label: 'Move', shortcut: 'T' },
    { mode: 'rotate', label: 'Rotate', shortcut: 'R' },
    { mode: 'scale', label: 'Scale', shortcut: 'S' },
  ]

  const handleExport = () => {
    const config = exportConfig()
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${config.name.replace(/\s+/g, '_').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string)
        importConfig(config)
      } catch (err) {
        console.error('Failed to parse config:', err)
        alert('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div style={toolbarStyle}>
      {/* Config name */}
      <input
        type="text"
        value={configName}
        onChange={(e) => setConfigName(e.target.value)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#eee',
          fontSize: '14px',
          fontWeight: 'bold',
          width: '150px',
        }}
      />

      <div style={separatorStyle} />

      {/* Transform mode */}
      <div style={buttonGroupStyle}>
        {modes.map(({ mode, label, shortcut }) => (
          <button
            key={mode}
            style={transformMode === mode ? activeButtonStyle : buttonStyle}
            onClick={() => setTransformMode(mode)}
            title={`${label} (${shortcut})`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Snap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
          />
          <span style={{ color: '#aaa', fontSize: '12px' }}>Snap</span>
        </label>
        {snapEnabled && (
          <select
            value={snapValue}
            onChange={(e) => setSnapValue(parseFloat(e.target.value))}
            style={{
              background: '#3a3a50',
              border: 'none',
              borderRadius: '4px',
              color: '#eee',
              padding: '4px 8px',
              fontSize: '12px',
            }}
          >
            {SNAP_VALUES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
      </div>

      {/* Reference car toggle */}
      <button
        style={showReferenceModel ? activeButtonStyle : buttonStyle}
        onClick={toggleReferenceModel}
        title="Toggle car reference (H)"
      >
        Car Ref
      </button>

      <div style={separatorStyle} />

      {/* Undo/Redo */}
      <div style={buttonGroupStyle}>
        <button
          style={{ ...buttonStyle, opacity: canUndo ? 1 : 0.4 }}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          style={{ ...buttonStyle, opacity: canRedo ? 1 : 0.4 }}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* File operations */}
      <button
        style={{ ...buttonStyle, background: '#3a5070' }}
        onClick={saveToLocalStorage}
        title="Save to browser (Ctrl+S)"
      >
        Save
      </button>
      <button
        style={{ ...buttonStyle, background: '#3a5070' }}
        onClick={handleExport}
        title="Export JSON (Ctrl+E)"
      >
        Export
      </button>
      <button
        style={buttonStyle}
        onClick={() => fileInputRef.current?.click()}
      >
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      <button
        style={{ ...buttonStyle, color: '#ff6666' }}
        onClick={() => {
          if (confirm('Clear all parts? This cannot be undone.')) {
            clearAll()
          }
        }}
      >
        Clear
      </button>

      {/* Back to game */}
      <div style={separatorStyle} />
      <a
        href="#/"
        style={{
          ...buttonStyle,
          textDecoration: 'none',
          color: '#88aaff',
        }}
      >
        Back to Game
      </a>
    </div>
  )
}
