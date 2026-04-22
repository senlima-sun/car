import HintBar from './HintBar'
import PenCanvas from './PenCanvas'
import Toolbar from './Toolbar'
import { useShortcuts } from './hooks/useShortcuts'

export default function TrackEditor() {
  useShortcuts()

  return (
    <div className='absolute inset-0 pointer-events-auto overflow-hidden font-sans text-white'>
      <PenCanvas />
      <div className='pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/36 via-black/10 to-transparent' />
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/32 via-black/10 to-transparent' />
      <Toolbar />
      <HintBar />
    </div>
  )
}
