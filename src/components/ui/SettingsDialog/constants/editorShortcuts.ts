export type EditorShortcutSection = {
  section: string
  items: { key: string; description: string }[]
}

export const EDITOR_SHORTCUTS: EditorShortcutSection[] = [
  {
    section: 'Placement',
    items: [
      { key: 'Click', description: 'Place object / Set point' },
      { key: 'R', description: 'Rotate object 90 degrees' },
      { key: 'Esc', description: 'Cancel current action' },
    ],
  },
  {
    section: 'Editing',
    items: [
      { key: 'Del', description: 'Delete selected object' },
      { key: 'Backspace', description: 'Delete selected object' },
    ],
  },
  {
    section: 'Camera',
    items: [
      { key: 'WASD', description: 'Pan camera' },
      { key: 'Scroll', description: 'Zoom in/out' },
    ],
  },
  {
    section: 'Mode',
    items: [{ key: 'Main Screen', description: 'Choose race, test, showroom, or settings' }],
  },
]
