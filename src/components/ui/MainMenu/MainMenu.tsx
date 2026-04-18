import { useGameStore } from '@/stores/useGameStore'
import { useSessionStore } from '@/stores/useSessionStore'

interface MenuAction {
  id: string
  label: string
  detail: string
  actionKey:
    | 'startRaceSession'
    | 'startTestSession'
    | 'openTrackEditor'
    | 'openShowroom'
    | 'openSettings'
}

const MENU_ACTIONS: MenuAction[] = [
  {
    id: 'race',
    label: 'Start Race',
    detail: 'Launch the countdown and go straight to the circuit.',
    actionKey: 'startRaceSession',
  },
  {
    id: 'test',
    label: 'Start Test',
    detail: 'Free practice run with debug overlay and testing tools.',
    actionKey: 'startTestSession',
  },
  {
    id: 'editor',
    label: 'Track Editor',
    detail: 'Open the editor and testing tools for track work.',
    actionKey: 'openTrackEditor',
  },
  {
    id: 'showroom',
    label: 'Watch Car',
    detail: 'Inspect the 2026 F1 model in the showroom camera.',
    actionKey: 'openShowroom',
  },
  {
    id: 'settings',
    label: 'Settings',
    detail: 'Tune controls and display options before you drive.',
    actionKey: 'openSettings',
  },
]

export default function MainMenu() {
  const gameActions = {
    enterSessionShell: useGameStore(s => s.enterSessionShell),
    openTrackEditor: useGameStore(s => s.openTrackEditor),
    openShowroom: useGameStore(s => s.openShowroom),
    openSettings: useGameStore(s => s.openSettings),
  }

  const sessionActions = {
    beginSessionFlow: useSessionStore(s => s.beginSessionFlow),
  }

  const handleAction = (actionKey: MenuAction['actionKey']) => {
    if (actionKey === 'startRaceSession') {
      sessionActions.beginSessionFlow('race')
      gameActions.enterSessionShell()
      return
    }

    if (actionKey === 'startTestSession') {
      sessionActions.beginSessionFlow('practice', { testingMode: true })
      gameActions.enterSessionShell()
      return
    }

    if (actionKey === 'openTrackEditor') {
      gameActions.openTrackEditor()
      return
    }

    if (actionKey === 'openShowroom') {
      gameActions.openShowroom()
      return
    }

    gameActions.openSettings()
  }

  return (
    <div className='absolute inset-0 z-30 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(201,44,44,0.24),transparent_38%),linear-gradient(135deg,rgba(8,10,15,0.9),rgba(8,10,15,0.66)_42%,rgba(21,25,34,0.88))] px-6 py-8 pointer-events-auto'>
      <div className='w-full max-w-6xl rounded-[32px] border border-white/12 bg-black/28 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl'>
        <div className='grid gap-8 px-6 py-6 md:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] md:px-10 md:py-10'>
          <section className='flex min-h-[360px] flex-col justify-between'>
            <div className='space-y-6'>
              <div className='inline-flex w-fit items-center rounded-full border border-red-400/35 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-red-100'>
                F1 2026 Simulator
              </div>
              <div className='space-y-4'>
                <h1 className='max-w-3xl font-mono text-4xl font-semibold uppercase tracking-[0.08em] text-white md:text-6xl'>
                  Main Screen
                </h1>
                <p className='max-w-2xl text-sm leading-7 text-white/72 md:text-base'>
                  Choose how to enter the sim. Race mode starts the lap flow, test mode gives you
                  free practice with debug tools, and the editor lets you build tracks.
                </p>
              </div>
            </div>

            <div className='grid gap-3 text-xs uppercase tracking-[0.28em] text-white/42 md:grid-cols-3'>
              <div className='rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4'>
                Countdown race start
              </div>
              <div className='rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4'>
                Free practice + debug
              </div>
              <div className='rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4'>
                Track editor + tools
              </div>
            </div>
          </section>

          <section className='grid gap-3 self-stretch'>
            {MENU_ACTIONS.map(item => (
              <button
                key={item.id}
                onClick={() => handleAction(item.actionKey)}
                className='group flex min-h-[92px] flex-col justify-between rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-5 py-4 text-left transition hover:border-red-300/45 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))]'
              >
                <div className='flex items-center justify-between gap-4'>
                  <span className='font-mono text-lg font-semibold uppercase tracking-[0.08em] text-white'>
                    {item.label}
                  </span>
                  <span className='rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/42 transition group-hover:border-red-300/35 group-hover:text-red-100'>
                    Enter
                  </span>
                </div>
                <span className='max-w-md text-sm leading-6 text-white/62'>{item.detail}</span>
              </button>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
