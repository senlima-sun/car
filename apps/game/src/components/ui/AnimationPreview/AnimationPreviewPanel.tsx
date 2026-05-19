import { motion } from 'motion/react'
import { CAR_PARTS, PAINT_PRESETS, useCarPaintStore } from '@/stores/useCarPaintStore'
import { useGameStore } from '@/stores/useGameStore'
import { useShowroomStore } from '@/stores/useShowroomStore'
import { sectionVariants } from './constants/animations'
import { AeroSection } from './sections/AeroSection'
import { CarPaintSection } from './sections/CarPaintSection'
import { SceneSection } from './sections/SceneSection'
import { SteeringSection } from './sections/SteeringSection'
import { WheelsSection } from './sections/WheelsSection'

export default function AnimationPreviewPanel() {
  const partColors = useCarPaintStore(s => s.partColors)
  const selectedPart = useCarPaintStore(s => s.selectedPart)
  const hoveredPart = useShowroomStore(s => s.hoveredPart)
  const activePresetName = PAINT_PRESETS.find(
    p => p.colors.body && p.colors.body.toLowerCase() === partColors.body.toLowerCase(),
  )?.name
  const hoveredPartLabel = hoveredPart
    ? CAR_PARTS.find(part => part.id === hoveredPart)?.label
    : null
  const selectedPartLabel =
    selectedPart === 'all' ? 'All Parts' : CAR_PARTS.find(part => part.id === selectedPart)?.label

  return (
    <>
      {hoveredPartLabel && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className='pointer-events-none absolute left-6 top-6 z-[100] rounded-lg border border-red-300/30 bg-black/70 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-red-100 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl'
        >
          {hoveredPartLabel}
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className='pointer-events-auto absolute left-4 right-4 top-4 bottom-4 z-[100] flex w-auto flex-col overflow-hidden rounded-xl border border-white/10 bg-black/72 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:left-auto sm:w-[520px]'
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
          <div className='mt-1.5 flex min-w-0 items-baseline justify-between gap-3'>
            <h2 className='font-mono text-[15px] font-semibold uppercase tracking-[0.18em] text-white'>
              Showroom
            </h2>
            <span className='min-w-0 truncate text-right font-mono text-[9px] uppercase tracking-[0.24em] text-white/35'>
              {selectedPartLabel}
              {activePresetName ? ` · ${activePresetName}` : ''}
            </span>
          </div>
        </div>

        <motion.div
          variants={sectionVariants}
          initial='hidden'
          animate='visible'
          className='grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(120px,180px)_minmax(0,1fr)] gap-3 overflow-hidden p-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:grid-rows-none'
        >
          <div className='min-h-0 overflow-y-auto rounded-lg border border-white/8 bg-white/[0.025] p-2'>
            <div className='mb-2 flex items-center justify-between px-1'>
              <span className='font-mono text-[9px] uppercase tracking-[0.28em] text-red-200/70'>
                Parts
              </span>
              <span className='font-mono text-[9px] uppercase tracking-[0.18em] text-white/35'>
                Hover / Click
              </span>
            </div>
            <div className='space-y-1'>
              <button
                onClick={() => useCarPaintStore.getState().setSelectedPart('all')}
                className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left transition ${
                  selectedPart === 'all'
                    ? 'border-red-300/60 bg-red-400/15 text-red-100'
                    : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white'
                }`}
              >
                <span className='font-mono text-[10px] uppercase tracking-[0.18em]'>All Parts</span>
              </button>
              {CAR_PARTS.map(part => (
                <button
                  key={part.id}
                  onClick={() => useCarPaintStore.getState().setSelectedPart(part.id)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
                    selectedPart === part.id
                      ? 'border-red-300/60 bg-red-400/15 text-red-100'
                      : hoveredPart === part.id
                        ? 'border-white/30 bg-white/[0.08] text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <span
                    className='h-2.5 w-2.5 shrink-0 rounded-full border border-white/25'
                    style={{ backgroundColor: partColors[part.id] }}
                  />
                  <span className='min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.18em]'>
                    {part.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className='showroom-scroll min-h-0 overflow-y-auto pr-1'>
            <CarPaintSection />
            <div className='grid grid-cols-1 gap-3 border-t border-white/5 pt-3 sm:grid-cols-2'>
              <AeroSection />
              <SteeringSection />
              <WheelsSection />
              <SceneSection />
            </div>
          </div>
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
    </>
  )
}
