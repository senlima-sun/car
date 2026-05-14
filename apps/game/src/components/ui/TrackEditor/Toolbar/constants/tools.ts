import {
  Flag,
  MousePointer2,
  Mountain,
  ParkingSquare,
  Pen,
  Split,
  Waves,
} from 'lucide-react'
import type { Tool } from '../../state/useTrackEditorStore'

export const TOOLS: Array<{ id: Tool; icon: typeof Pen; label: string; kbd?: string }> = [
  { id: 'pen', icon: Pen, label: 'Pen', kbd: 'P' },
  { id: 'select', icon: MousePointer2, label: 'Select', kbd: 'V' },
  { id: 'start-finish', icon: Flag, label: 'Start / Finish' },
  { id: 'sector', icon: Split, label: 'Sector' },
  { id: 'pit-area', icon: ParkingSquare, label: 'Pit Area' },
  { id: 'curb', icon: Waves, label: 'Curb', kbd: 'C' },
  { id: 'terrain', icon: Mountain, label: 'Terrain', kbd: 'T' },
]
