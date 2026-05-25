import type { HTMLAttributes } from 'react'
import { surface, type SurfaceVariant } from './tokens'

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant
}

export function Surface({ variant = 'card', className, children, ...rest }: SurfaceProps) {
  const cls = className ? `${surface[variant]} ${className}` : surface[variant]
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  )
}
