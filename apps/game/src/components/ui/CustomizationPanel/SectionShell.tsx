import { type ReactNode } from 'react'
import { LabelTag } from '../primitives'

interface Props {
  title: string
  children: ReactNode
}

export function SectionShell({ title, children }: Props) {
  return (
    <div className='mb-4'>
      <LabelTag className='block mb-2'>{title}</LabelTag>
      {children}
    </div>
  )
}
