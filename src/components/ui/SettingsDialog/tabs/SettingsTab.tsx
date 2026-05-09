import { useGameStore } from '@/stores/useGameStore'
import { MouseSteeringAdvanced } from '../components/MouseSteeringAdvanced'

export function SettingsTab() {
  const showFPS = useGameStore(s => s.showFPS)
  const toggleShowFPS = useGameStore(s => s.toggleShowFPS)
  const mouseSteeringEnabled = useGameStore(s => s.mouseSteeringEnabled)
  const setMouseSteeringEnabled = useGameStore(s => s.setMouseSteeringEnabled)
  const enterMenu = useGameStore(s => s.enterMenu)

  return (
    <div>
      <div className='flex justify-between items-center py-2 mb-4'>
        <div>
          <div className='text-white text-[13px] font-medium'>Mouse Steering Wheel</div>
          <div className='text-white/40 text-[11px] mt-0.5'>
            Steer with the mouse instead of A/D keys. Pointer is captured during racing.
          </div>
        </div>
        <button
          onClick={() => setMouseSteeringEnabled(!mouseSteeringEnabled)}
          className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
            mouseSteeringEnabled ? 'bg-white/40' : 'bg-white/20'
          }`}
        >
          <div
            className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-[left] ${
              mouseSteeringEnabled ? 'left-[23px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>

      {mouseSteeringEnabled && <MouseSteeringAdvanced />}

      <div className='flex justify-between items-center py-2 mb-4 border-b border-white/5 pb-4'>
        <div>
          <div className='text-white text-[13px] font-medium'>FPS Counter</div>
          <div className='text-white/40 text-[11px] mt-0.5'>
            Display frames per second in the top-left corner
          </div>
        </div>
        <button
          onClick={toggleShowFPS}
          className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
            showFPS ? 'bg-white/40' : 'bg-white/20'
          }`}
        >
          <div
            className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-[left] ${
              showFPS ? 'left-[23px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>

      <div className='flex justify-between items-center py-2'>
        <div>
          <div className='text-white text-[13px] font-medium'>Main Screen</div>
          <div className='text-white/40 text-[11px] mt-0.5'>
            Return to the mode selector to start a race, test session, or showroom view
          </div>
        </div>
        <button
          onClick={enterMenu}
          className='rounded-full border border-white/15 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/12'
        >
          Open
        </button>
      </div>
    </div>
  )
}
