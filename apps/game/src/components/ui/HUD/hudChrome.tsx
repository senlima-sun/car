import { STATUS } from '../../../constants/colors'

export const HUD_DIVIDER_CLASS =
  'w-px self-stretch bg-gradient-to-b from-transparent via-white/14 to-transparent'
export const HUD_LABEL_CLASS = 'text-[8px] font-semibold uppercase tracking-[0.32em] text-white/45'
export const HUD_MICRO_LABEL_CLASS = HUD_LABEL_CLASS

export const HUD_DISPLAY_DIGIT_CLASS = 'font-mono font-bold leading-none tabular-nums'
export const HUD_NUMERIC_CLASS = 'font-mono font-semibold tabular-nums'

export const HUD_STATUS = {
  success: STATUS.success,
  warning: STATUS.warning,
  danger: STATUS.danger,
  info: STATUS.info,
  neutral: STATUS.neutral,
} as const

export const HUD_ACCENT = {
  speed: '#00e5ff',
  battery: '#b388ff',
  ers: '#b388ff',
  gear: '#ffffff',
  reverse: '#ff9f43',
  limiter: '#ff2929',
} as const

export { wearColor, isWearCritical } from './wearColor'
export * from './rpmZones'
