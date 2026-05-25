import { divider, dividerHorizontal } from './tokens'

type DividerProps = {
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

export function Divider({ orientation = 'vertical', className }: DividerProps) {
  const base = orientation === 'vertical' ? divider : dividerHorizontal
  const cls = className ? `${base} ${className}` : base
  return <div className={cls} aria-hidden />
}
