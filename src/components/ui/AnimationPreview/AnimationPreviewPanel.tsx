import { motion } from 'motion/react'
import { PAINT_PRESETS, useCarPaintStore } from '@/stores/useCarPaintStore'
import { useGameStore } from '@/stores/useGameStore'
import { sectionVariants } from './constants/animations'
import { AeroSection } from './sections/AeroSection'
import { CarPaintSection } from './sections/CarPaintSection'
import { SceneSection } from './sections/SceneSection'
import { SteeringSection } from './sections/SteeringSection'
import { WheelsSection } from './sections/WheelsSection'

export default function AnimationPreviewPanel() {
  const partColors = useCarPaintStore(s => s.partColors)
  const activePresetName = PAINT_PRESETS.find(
    p => p.colors.body && p.colors.body.toLowerCase() === partColors.body.toLowerCase(),
  )?.name

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className='pointer-events-auto absolute right-4 top-4 z-[100] flex max-h-[calc(100vh-32px)] w-[296px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl'
    >
      <div className='relative border-b border-white/8 px-4 pt-3.5 pb-3'>
        <div className='flex items-center gap-2.5'>
          <motion.span
            className='inline-block h-px bg-red-400/70'
            initial={{ width: 0 }}
            animate={{ width: 22 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          />
          <span className='font-mono text-[9px] uppercase tracking-[0.36em] text-red-300/80'>
            F1 · 2026
          </span>
          <span className='ml-auto flex items-center gap-1.5'>
            <motion.span
              animate={{ opacity: [0.4, 0.95, 0.4] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className='h-1.5 w-1.5 rounded-full bg-red-400'
            />
            <span className='font-mono text-[9px] uppercase tracking-[0.28em] text-white/30'>
              F2
            </span>
          </span>
        </div>
        <div className='mt-1.5 flex items-baseline justify-between'>
          <h2 className='font-mono text-[15px] font-semibold uppercase tracking-[0.18em] text-white'>
            Showroom
          </h2>
          {activePresetName && (
            <span className='font-mono text-[9px] uppercase tracking-[0.24em] text-white/35'>
              {activePresetName}
            </span>
          )}
        </div>
      </div>

      <motion.div
        variants={sectionVariants}
        initial='hidden'
        animate='visible'
        className='showroom-scroll divide-y divide-white/5 overflow-y-auto px-4'
      >
        <AeroSection />
        <SteeringSection />
        <WheelsSection />
        <CarPaintSection />
        <SceneSection />
      </motion.div>

      <div className='border-t border-white/8 px-4 py-3'>
        <button
          onClick={() => useGameStore.getState().exitPreviewMode()}
          className='group flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-red-300/50 hover:bg-red-500/10 focus-visible:border-red-300/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-300/40'
        >
          <span className='flex items-baseline gap-2'>
            <span className='font-mono text-xs text-white/30 transition group-hover:-translate-x-1 group-hover:text-red-200'>
              ←
            </span>
            <span className='font-mono text-[11px] uppercase tracking-[0.24em] text-white/85 group-hover:text-red-100'>
              Back
            </span>
          </span>
          <span className='rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 group-hover:border-red-300/40 group-hover:text-red-200/80'>
            F2
          </span>
        </button>
      </div>
    </motion.div>
  )
}
