import { motion } from 'motion/react'
import { sectionItem } from '../constants/animations'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section variants={sectionItem} className='py-3'>
      <div className='mb-2 flex items-center gap-2'>
        <span className='h-px w-4 bg-red-300/50' />
        <span className='font-mono text-[9px] uppercase tracking-[0.32em] text-red-200/70'>
          {title}
        </span>
      </div>
      <div className='space-y-1.5'>{children}</div>
    </motion.section>
  )
}
