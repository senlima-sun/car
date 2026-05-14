import HintBar from './HintBar'
import PenCanvas from './PenCanvas'
import Toolbar from './Toolbar'
import { useShortcuts } from './hooks/useShortcuts'

export default function TrackEditor() {
  useShortcuts()

  return (
    <div className='absolute inset-0 pointer-events-auto overflow-hidden font-sans text-white'>
      <PenCanvas />
      <Toolbar />
      <HintBar />
    </div>
  )
}
