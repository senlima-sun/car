import { motion } from 'motion/react'
import { useNavigate } from '@tanstack/react-router'
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
    label: 'Race',
    detail: 'Countdown · timed laps',
    actionKey: 'startRaceSession',
  },
  {
    id: 'test',
    label: 'Test',
    detail: 'Free practice · debug',
    actionKey: 'startTestSession',
  },
  {
    id: 'editor',
    label: 'Editor',
    detail: 'Build tracks',
    actionKey: 'openTrackEditor',
  },
  {
    id: 'showroom',
    label: 'Showroom',
    detail: 'Inspect the 2026 car',
    actionKey: 'openShowroom',
  },
  {
    id: 'settings',
    label: 'Settings',
    detail: 'Controls · display',
    actionKey: 'openSettings',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

export default function MainMenu() {
  const navigate = useNavigate()
  const gameActions = {
    enterSessionShell: useGameStore(s => s.enterSessionShell),
    openTrackEditor: useGameStore(s => s.openTrackEditor),
    openShowroom: useGameStore(s => s.openShowroom),
    openSettings: useGameStore(s => s.openSettings),
  }

  const sessionActions = {
    beginSessionFlow: useSessionStore(s => s.beginSessionFlow),
    startQuickSession: useSessionStore(s => s.startQuickSession),
  }

  const handleAction = (actionKey: MenuAction['actionKey']) => {
    if (actionKey === 'startRaceSession') {
      sessionActions.beginSessionFlow('race')
      gameActions.enterSessionShell()
      return
    }

    if (actionKey === 'startTestSession') {
      sessionActions.startQuickSession('practice', { testingMode: true })
      gameActions.enterSessionShell()
      return
    }

    if (actionKey === 'openTrackEditor') {
      gameActions.openTrackEditor()
      navigate({ to: '/track-editor' })
      return
    }

    if (actionKey === 'openShowroom') {
      gameActions.openShowroom()
      navigate({ to: '/showroom' })
      return
    }

    gameActions.openSettings()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className='pointer-events-auto absolute inset-0  z-30 flex items-center justify-center bg-gradient-to-b from-black/85 via-black/65 to-black/95'
    >
      <motion.div
        variants={containerVariants}
        initial='hidden'
        animate='visible'
        className='flex w-full max-w-md flex-col gap-6'
      >
        <motion.header variants={itemVariants} className='space-y-3'>
          <motion.div
            className='flex items-center gap-3'
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <motion.span
              className='inline-block h-px bg-red-400/70'
              initial={{ width: 0 }}
              animate={{ width: 28 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            />
            <span className='font-mono text-[10px] uppercase tracking-[0.42em] text-red-300/80'>
              F1 · 2026
            </span>
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className='font-mono text-4xl font-semibold uppercase tracking-[0.12em] text-white'
          >
            Simulator
          </motion.h1>
        </motion.header>

        <motion.nav variants={containerVariants} className='flex flex-col'>
          {MENU_ACTIONS.map(item => (
            <motion.button
              key={item.id}
              variants={itemVariants}
              onClick={() => handleAction(item.actionKey)}
              whileHover='hover'
              whileTap={{ scale: 0.985 }}
              className='group relative flex items-baseline justify-between overflow-hidden border-b border-white/8 py-2.5 text-left'
            >
              <motion.span
                aria-hidden
                className='pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/10 to-transparent'
                initial={{ width: 0 }}
                variants={{ hover: { width: '100%' } }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
              <motion.span
                aria-hidden
                className='pointer-events-none absolute bottom-0 left-0 h-px bg-red-300/70'
                initial={{ width: 0 }}
                variants={{ hover: { width: '100%' } }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
              <span className='relative flex items-baseline gap-3'>
                <motion.span
                  variants={{ hover: { x: 6, color: 'rgb(254 202 202)' } }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className='font-mono text-sm font-medium uppercase tracking-[0.18em] text-white/90'
                >
                  {item.label}
                </motion.span>
                <span className='text-[10px] uppercase tracking-[0.24em] text-white/40'>
                  {item.detail}
                </span>
              </span>
              <motion.span
                aria-hidden
                variants={{ hover: { x: 8, color: 'rgb(254 202 202)', opacity: 1 } }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className='relative font-mono text-xs text-white/25'
              >
                →
              </motion.span>
            </motion.button>
          ))}
        </motion.nav>

        <motion.div
          variants={itemVariants}
          className='flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.32em] text-white/30'
        >
          <span>v26.1</span>
          <motion.span
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className='flex items-center gap-2'
          >
            <span className='inline-block h-1.5 w-1.5 rounded-full bg-red-400' />
            Ready
          </motion.span>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
