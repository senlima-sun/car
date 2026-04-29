import { type ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

export function SectionShell({ title, children }: Props) {
  return (
    <div className='mb-[15px]'>
      <div className='text-[#888] text-[11px] uppercase mb-2'>{title}</div>
      {children}
    </div>
  )
}
