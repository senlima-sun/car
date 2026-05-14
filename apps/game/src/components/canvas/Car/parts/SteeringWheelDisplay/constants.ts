export const CW = 1280
export const CH = 640
export const MAX_RPM = 12500
export const FLASH_DUR = 0.8

export const FM = 'Consolas, "Courier New", monospace'
export const FS = 'Arial, Helvetica, sans-serif'

export const BORDER = 'rgba(255,255,255,0.45)'
export const LW = 2
export const DIM = 'rgba(255,255,255,0.18)'
export const LABEL_COL = 'rgba(255,255,255,0.5)'
export const WHITE = '#ffffff'
export const GREEN = '#22c55e'
export const RED = '#ef4444'
export const YELLOW = '#eab308'
export const BLUE = '#3b82f6'
export const PURPLE = '#a855f7'
export const ORANGE = '#f97316'
export const SPEED_GREEN = '#00ff88'
export const CYAN = '#06b6d4'
export const TIRE_BG = 'rgba(100,210,230,0.15)'

export const PAD = 8
export const COLS = 6
export const BAT_H = 30
export const GRID_X = PAD
export const GRID_Y = PAD
export const GRID_W = CW - PAD * 2
export const GRID_H = CH - PAD * 2 - BAT_H - 2

export const ROW_WEIGHTS = [1, 1, 1, 1, 1]
export const TOTAL_RW = ROW_WEIGHTS.reduce((a, b) => a + b, 0)
