import { useState, useRef } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { isWallType } from '../../../types/trackObjects'

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    marginTop: 6,
  },
  title: {
    color: '#8a8a8a',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  label: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 4,
    display: 'block',
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    color: '#fff',
    fontSize: 11,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  buttonRow: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: '6px 10px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  preview: {
    marginTop: 8,
    borderRadius: 4,
    overflow: 'hidden',
    background: 'rgba(0, 0, 0, 0.3)',
    textAlign: 'center' as const,
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: 80,
    objectFit: 'contain' as const,
  },
}

export default function WallPropertiesPanel() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const updateObject = useCustomizationStore(s => s.updateObject)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)

  const selectedWall = selectedObjectId
    ? placedObjects.find(o => o.id === selectedObjectId && isWallType(o.type))
    : null

  const [urlInput, setUrlInput] = useState(selectedWall?.adImageUrl ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!selectedWall) return null

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      updateObject(selectedWall.id, { adImageUrl: urlInput.trim() })
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      updateObject(selectedWall.id, { adImageUrl: dataUrl })
      setUrlInput(dataUrl.slice(0, 40) + '...')
    }
    reader.readAsDataURL(file)
  }

  const handleClear = () => {
    updateObject(selectedWall.id, { adImageUrl: undefined })
    setUrlInput('')
  }

  const currentUrl = selectedWall.adImageUrl

  return (
    <div style={styles.container}>
      <div style={styles.title}>Ad Image</div>

      <label style={styles.label}>Image URL</label>
      <input
        type='text'
        style={styles.input}
        value={urlInput}
        onChange={e => setUrlInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleUrlApply()
          e.stopPropagation()
        }}
        placeholder='https://example.com/ad.jpg'
      />

      <div style={styles.buttonRow}>
        <button
          style={{ ...styles.button, background: '#2563eb', color: '#fff' }}
          onClick={handleUrlApply}
        >
          Apply URL
        </button>
        <button
          style={{ ...styles.button, background: '#666', color: '#fff' }}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload
        </button>
      </div>

      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {currentUrl && (
        <>
          <div style={styles.preview}>
            <img
              src={currentUrl}
              alt='Ad preview'
              style={styles.previewImage}
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <button
            style={{
              ...styles.button,
              background: '#dc2626',
              color: '#fff',
              marginTop: 6,
              width: '100%',
            }}
            onClick={handleClear}
          >
            Clear Ad
          </button>
        </>
      )}
    </div>
  )
}
