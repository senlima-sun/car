import { useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { usePartEditorStore } from './store'
import EditorScene from './canvas/EditorScene'
import EditorLayout from './ui/EditorLayout'

export default function PartEditor() {
  const loadFromLocalStorage = usePartEditorStore(s => s.loadFromLocalStorage)
  const pushHistory = usePartEditorStore(s => s.pushHistory)
  const setTransformMode = usePartEditorStore(s => s.setTransformMode)
  const selectPart = usePartEditorStore(s => s.selectPart)
  const selectedPartId = usePartEditorStore(s => s.selectedPartId)
  const removePart = usePartEditorStore(s => s.removePart)
  const duplicatePart = usePartEditorStore(s => s.duplicatePart)
  const undo = usePartEditorStore(s => s.undo)
  const redo = usePartEditorStore(s => s.redo)
  const setSnapEnabled = usePartEditorStore(s => s.setSnapEnabled)
  const snapEnabled = usePartEditorStore(s => s.snapEnabled)
  const saveToLocalStorage = usePartEditorStore(s => s.saveToLocalStorage)
  const toggleReferenceModel = usePartEditorStore(s => s.toggleReferenceModel)

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadFromLocalStorage()
    if (!loaded) {
      pushHistory()
    }
  }, [loadFromLocalStorage, pushHistory])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const key = e.key.toLowerCase()

      // Transform modes
      if (key === 't' && !e.ctrlKey && !e.metaKey) {
        setTransformMode('translate')
        return
      }
      if (key === 'r' && !e.ctrlKey && !e.metaKey) {
        setTransformMode('rotate')
        return
      }
      if (key === 's' && !e.ctrlKey && !e.metaKey) {
        setTransformMode('scale')
        return
      }

      // Escape to deselect
      if (key === 'escape') {
        selectPart(null)
        return
      }

      // Delete selected part
      if ((key === 'delete' || key === 'backspace') && selectedPartId) {
        e.preventDefault()
        removePart(selectedPartId)
        return
      }

      // Duplicate (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && key === 'd' && selectedPartId) {
        e.preventDefault()
        duplicatePart(selectedPartId)
        return
      }

      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }

      // Toggle snap (G)
      if (key === 'g' && !e.ctrlKey && !e.metaKey) {
        setSnapEnabled(!snapEnabled)
        return
      }

      // Toggle reference car (H)
      if (key === 'h' && !e.ctrlKey && !e.metaKey) {
        toggleReferenceModel()
        return
      }

      // Save (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault()
        saveToLocalStorage()
        return
      }
    },
    [
      setTransformMode,
      selectPart,
      selectedPartId,
      removePart,
      duplicatePart,
      undo,
      redo,
      setSnapEnabled,
      snapEnabled,
      saveToLocalStorage,
      toggleReferenceModel,
    ],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1a2e',
      }}
    >
      <EditorLayout>
        <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }} style={{ background: '#2a2a3e' }}>
          <EditorScene />
        </Canvas>
      </EditorLayout>
    </div>
  )
}
