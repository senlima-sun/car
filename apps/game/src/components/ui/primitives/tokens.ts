export const surfacePill =
  'rounded-full border border-white/10 bg-[rgba(14,16,22,0.82)] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.32)]'

export const surfaceCard =
  'rounded-2xl border border-white/10 bg-[rgba(14,16,22,0.82)] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.32)]'

export const surfaceCardStrong =
  'rounded-2xl border border-white/12 bg-[rgba(10,12,18,0.92)] backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.45)]'

export const surface = {
  pill: surfacePill,
  card: surfaceCard,
  cardStrong: surfaceCardStrong,
} as const

export type SurfaceVariant = keyof typeof surface

export const labelTag = 'text-[9px] font-bold uppercase tracking-[0.22em] text-white/45'

export const divider = 'w-px bg-white/10'
export const dividerHorizontal = 'h-px bg-white/10'

export const iconBtnBase =
  'group relative inline-flex h-9 w-9 items-center justify-center rounded-full transition'

export const iconBtnVariant = {
  default: 'text-white/66 hover:bg-white/[0.08] hover:text-white',
  active: 'bg-white/[0.12] text-white',
  primary: 'bg-sky-500/22 text-white hover:bg-sky-500/32',
  danger: 'text-red-200/86 hover:bg-red-500/18 hover:text-red-50',
  disabled: 'cursor-not-allowed text-white/28',
} as const

export type IconBtnVariantKey = keyof typeof iconBtnVariant
