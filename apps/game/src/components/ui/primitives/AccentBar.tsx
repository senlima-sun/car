type AccentBarProps = {
  color: string
  glow?: boolean
}

export function AccentBar({ color, glow = true }: AccentBarProps) {
  return (
    <div
      className='absolute left-0 top-0 h-full w-[3px] rounded-l-[2px]'
      style={{
        background: color,
        boxShadow: glow ? `0 0 10px ${color}` : undefined,
      }}
    />
  )
}
