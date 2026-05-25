import type { HTMLAttributes } from 'react'
import { labelTag } from './tokens'

export function LabelTag({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  const cls = className ? `${labelTag} ${className}` : labelTag
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  )
}
