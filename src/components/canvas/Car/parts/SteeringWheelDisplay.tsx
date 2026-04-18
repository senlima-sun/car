import { useCarStore } from '@/stores/useCarStore'
import { useErsStore } from '@/stores/useErsStore'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useTireStore } from '@/stores/useTireStore'
import { useBrakeStore } from '@/stores/useBrakeStore'
import { useTemperatureStore } from '@/stores/useTemperatureStore'
import {
  formatLapTime,
  getGearDisplay,
  getGearColor,
  getPresetAbbreviation,
  getPresetColor,
} from '@/utils/steeringDisplayHelpers'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSwDisplayStore } from '@/stores/useSwDisplayStore'
import { useGhostCarStore } from '@/stores/useGhostCarStore'

const CW = 1280
const CH = 640
const MAX_RPM = 12500
const FLASH_DUR = 0.8

const FM = 'Consolas, "Courier New", monospace'
const FS = 'Arial, Helvetica, sans-serif'

const BORDER = 'rgba(255,255,255,0.45)'
const LW = 2
const DIM = 'rgba(255,255,255,0.18)'
const LABEL_COL = 'rgba(255,255,255,0.5)'
const WHITE = '#ffffff'
const GREEN = '#22c55e'
const RED = '#ef4444'
const YELLOW = '#eab308'
const BLUE = '#3b82f6'
const PURPLE = '#a855f7'
const ORANGE = '#f97316'
const SPEED_GREEN = '#00ff88'
const CYAN = '#06b6d4'
const TIRE_BG = 'rgba(100,210,230,0.15)'

const PAD = 8
const COLS = 6
const BAT_H = 30
const GRID_X = PAD
const GRID_Y = PAD
const GRID_W = CW - PAD * 2
const GRID_H = CH - PAD * 2 - BAT_H - 2

const ROW_WEIGHTS = [1, 1, 1, 1, 1]
const TOTAL_RW = ROW_WEIGHTS.reduce((a, b) => a + b, 0)

function colX(c: number): number {
  return GRID_X + (c / COLS) * GRID_W
}
function colW(span: number): number {
  return (span / COLS) * GRID_W
}

function rowY(r: number): number {
  let sum = 0
  for (let i = 0; i < r; i++) sum += ROW_WEIGHTS[i]
  return GRID_Y + (sum / TOTAL_RW) * GRID_H
}
function rowH(r: number, span: number): number {
  let sum = 0
  for (let i = r; i < r + span; i++) sum += ROW_WEIGHTS[i]
  return (sum / TOTAL_RW) * GRID_H
}

interface CellBounds {
  x: number
  y: number
  w: number
  h: number
}

function cellBounds(col: number, row: number, cSpan = 1, rSpan = 1): CellBounds {
  return { x: colX(col), y: rowY(row), w: colW(cSpan), h: rowH(row, rSpan) }
}

function tempToC(n: number): number {
  return Math.round(20 + n * 130)
}

function tireTempCol(n: number): string {
  if (n < 0.3) return BLUE
  if (n < 0.55) return GREEN
  if (n < 0.75) return YELLOW
  if (n < 0.9) return ORANGE
  return RED
}

function wearCol(w: number): string {
  return w >= 90 ? RED : w >= 70 ? YELLOW : GREEN
}

function strokeCell(ctx: CanvasRenderingContext2D, b: CellBounds, bg?: string) {
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(b.x, b.y, b.w, b.h)
  }
  ctx.strokeStyle = BORDER
  ctx.lineWidth = LW
  ctx.strokeRect(b.x, b.y, b.w, b.h)
}

function drawLabel(ctx: CanvasRenderingContext2D, b: CellBounds, label: string, color = LABEL_COL) {
  const fs = Math.round(Math.min(b.h * 0.22, 22))
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = `bold ${fs}px ${FS}`
  ctx.fillText(label, b.x + 6, b.y + 4)
}

function drawValue(
  ctx: CanvasRenderingContext2D,
  b: CellBounds,
  value: string,
  color: string,
  sizeFactor = 0.5,
) {
  const fs = Math.round(Math.min(b.h * sizeFactor, 72))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.font = `bold ${fs}px ${FM}`
  ctx.fillText(value, b.x + b.w / 2, b.y + b.h * 0.58)
}

function drawSub(ctx: CanvasRenderingContext2D, b: CellBounds, sub: string, color = LABEL_COL) {
  const fs = Math.round(Math.min(b.h * 0.17, 16))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = color
  ctx.font = `${fs}px ${FS}`
  ctx.fillText(sub, b.x + b.w / 2, b.y + b.h - 3)
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  b: CellBounds,
  label: string,
  value: string,
  color: string,
  opts?: {
    bg?: string
    sub?: string
    subColor?: string
    labelColor?: string
    sizeFactor?: number
  },
) {
  strokeCell(ctx, b, opts?.bg)
  drawLabel(ctx, b, label, opts?.labelColor)
  drawValue(ctx, b, value, color, opts?.sizeFactor)
  if (opts?.sub) drawSub(ctx, b, opts.sub, opts.subColor)
}

function drawBatteryBar(ctx: CanvasRenderingContext2D, charge: number) {
  const x = PAD
  const y = CH - PAD - BAT_H
  const w = CW - PAD * 2
  const h = BAT_H

  ctx.strokeStyle = BORDER
  ctx.lineWidth = LW
  ctx.strokeRect(x, y, w, h)

  const segments = 24
  const sp = 3
  const segW = (w - sp * 2) / segments
  const segH = h - sp * 2
  const filled = Math.round((charge / 100) * segments)

  for (let i = 0; i < filled; i++) {
    const ratio = i / segments
    ctx.fillStyle = ratio < 0.25 ? RED : ratio < 0.45 ? ORANGE : GREEN
    ctx.fillRect(x + sp + i * segW + 1, y + sp, segW - 2, segH)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = LABEL_COL
  ctx.font = `bold ${Math.round(h * 0.5)}px ${FS}`
  ctx.fillText('SOC', x + w - 8, y + h / 2)
}

export function useSteeringWheelDisplay() {
  const speed = useCarStore(s => s.speed)
  const gear = useCarStore(s => s.gear)
  const rpm = useCarStore(s => s.rpm)

  const ersPreset = useErsStore(s => s.semiAutoConfig.preset)
  const ersMode = useErsStore(s => s.mode)
  const superClipActive = useErsStore(s => s.superClipActive)
  const overtakeAvailable = useErsStore(s => s.overtakeAvailable)
  const batteryCharge = useErsStore(s => s.batteryCharge)

  const aeroMode = useActiveAeroStore(s => s.mode)

  const bestLapTime = useLapTimeStore(s => s.bestLapTime)
  const lastLapTime = useLapTimeStore(s => s.lastLapTime)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const lastSectorSplit = useLapTimeStore(s => s.lastSectorSplit)
  const perWheelWear = useTireStore(s => s.perWheelWear)

  const frontBias = useBrakeStore(s => s.frontBias)
  const engineBraking = useBrakeStore(s => s.engineBraking)

  const tires = useTemperatureStore(s => s.tires)
  const ghostTimeDelta = useGhostCarStore(s => s.ghostTimeDelta)

  const prevPresetRef = useRef(ersPreset)
  const flashRef = useRef<number | null>(null)

  const { canvas, texture } = useSwDisplayStore()
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  if (!ctxRef.current) ctxRef.current = canvas.getContext('2d')

  const prevValuesRef = useRef('')

  useFrame(state => {
    const ctx = ctxRef.current
    if (!ctx) return
    const t = state.clock.elapsedTime

    if (ersPreset !== prevPresetRef.current) {
      flashRef.current = t
      prevPresetRef.current = ersPreset
    }

    const flashing = flashRef.current !== null && t - flashRef.current < FLASH_DUR
    const ovt = ersMode === 'Overtake' || superClipActive

    const key = `${Math.round(speed)}|${gear}|${Math.round(rpm / 100)}|${ersPreset}|${ersMode}|${superClipActive}|${overtakeAvailable}|${Math.round(batteryCharge)}|${aeroMode}|${bestLapTime}|${lastLapTime}|${lapCount}|${lastSectorSplit?.time}|${Math.round(frontBias * 10)}|${engineBraking}|${Math.round(tires.front_left_inner * 20)}|${Math.round(tires.front_right_inner * 20)}|${Math.round(tires.rear_left_inner * 20)}|${Math.round(tires.rear_right_inner * 20)}|${Math.round(perWheelWear.frontLeft)}|${Math.round(perWheelWear.frontRight)}|${Math.round(perWheelWear.rearLeft)}|${Math.round(perWheelWear.rearRight)}|${ghostTimeDelta !== null ? Math.round(ghostTimeDelta / 10) : ''}`

    const needsRedraw = key !== prevValuesRef.current || flashing || ovt
    if (!needsRedraw) return

    prevValuesRef.current = key

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, CW, CH)

    drawGrid(ctx, ovt)
    drawBatteryBar(ctx, batteryCharge)

    if (flashing) {
      const a = 1 - (t - flashRef.current!) / FLASH_DUR
      const pc = getPresetColor(ersPreset)
      ctx.save()
      ctx.globalAlpha = a
      ctx.strokeStyle = pc
      ctx.lineWidth = 16 * a
      ctx.strokeRect(4, 4, CW - 8, CH - 8)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = pc
      ctx.font = `bold ${CH * 0.22}px ${FS}`
      ctx.fillText(`${getPresetAbbreviation(ersPreset)} ERS`, CW / 2, CH / 2)
      ctx.restore()
    }

    if (ovt) {
      const pa = 0.35 + Math.sin(t * 8) * 0.25
      ctx.save()
      ctx.globalAlpha = pa
      ctx.strokeStyle = PURPLE
      ctx.lineWidth = 8
      ctx.strokeRect(2, 2, CW - 4, CH - 4)
      ctx.restore()
    }

    texture.needsUpdate = true
  })

  function drawGrid(ctx: CanvasRenderingContext2D, ovt: boolean) {
    let deltaStr = '-.--'
    let deltaCol = DIM
    if (ghostTimeDelta !== null) {
      deltaStr = `${ghostTimeDelta <= 0 ? '-' : '+'}${Math.abs(ghostTimeDelta / 1000).toFixed(2)}`
      deltaCol = ghostTimeDelta <= 0 ? GREEN : RED
    } else if (lastSectorSplit?.delta !== null && lastSectorSplit?.delta !== undefined) {
      const d = lastSectorSplit.delta
      deltaStr = `${d <= 0 ? '-' : '+'}${Math.abs(d / 1000).toFixed(2)}`
      deltaCol = d <= 0 ? GREEN : RED
    } else if (lastLapTime !== null && bestLapTime !== null) {
      const d = lastLapTime - bestLapTime
      deltaStr = `${d <= 0 ? '-' : '+'}${Math.abs(d / 1000).toFixed(2)}`
      deltaCol = d <= 0 ? GREEN : RED
    }

    const socVal =
      ({ Aggressive: '3', Balanced: '5', Conservative: '8' } as Record<string, string>)[
        ersPreset
      ] ?? '5'
    const ebVal =
      ({ Low: '2', Medium: '5', High: '8' } as Record<string, string>)[engineBraking] ?? '5'
    const aeroVal = aeroMode === 'Corner' ? 'CRN' : 'STR'
    const aeroCol = aeroMode === 'Corner' ? BLUE : GREEN
    const otVal = ovt ? 'ON' : overtakeAvailable ? 'RDY' : 'OFF'
    const otCol = ovt ? PURPLE : overtakeAvailable ? YELLOW : DIM
    const batCol = batteryCharge < 20 ? RED : batteryCharge < 50 ? ORANGE : GREEN

    const flT = (tires.front_left_inner + tires.front_left_outer) / 2
    const frT = (tires.front_right_inner + tires.front_right_outer) / 2
    const rlT = (tires.rear_left_inner + tires.rear_left_outer) / 2
    const rrT = (tires.rear_right_inner + tires.rear_right_outer) / 2

    const flW = perWheelWear.frontLeft
    const frW = perWheelWear.frontRight
    const rlW = perWheelWear.rearLeft
    const rrW = perWheelWear.rearRight
    const flLife = Math.max(0, 100 - flW)
    const frLife = Math.max(0, 100 - frW)
    const rlLife = Math.max(0, 100 - rlW)
    const rrLife = Math.max(0, 100 - rrW)

    const bestStr = bestLapTime !== null ? formatLapTime(bestLapTime) : '-:--.---'

    // ── Row 0: BEST(0-1) | SPEED(2-3) | DELTA(4-5) ──
    drawCell(ctx, cellBounds(0, 0, 2, 1), 'BEST', bestStr, GREEN, { sizeFactor: 0.45 })
    drawCell(ctx, cellBounds(2, 0, 2, 1), '', Math.round(Math.abs(speed)).toString(), SPEED_GREEN, {
      sizeFactor: 0.6,
    })
    drawCell(ctx, cellBounds(4, 0, 2, 1), 'DELTA', deltaStr, deltaCol, { sizeFactor: 0.5 })

    // ── Row 1: SOC(0) | EB(1) | GEAR(2-3, spans r1-r2) | BB(4) | LAP(5) ──
    drawCell(ctx, cellBounds(0, 1), 'SOC', socVal, GREEN)
    drawCell(ctx, cellBounds(1, 1), 'EB', ebVal, ORANGE)

    const gearBounds = cellBounds(2, 1, 2, 2)
    strokeCell(ctx, gearBounds, ovt ? 'rgba(168,85,247,0.12)' : undefined)
    {
      const gd = getGearDisplay(gear)
      const gc = getGearColor(gear, rpm, MAX_RPM)
      const fs = Math.round(Math.min(gearBounds.h * 0.65, 120))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = gc
      ctx.font = `bold ${fs}px ${FM}`
      ctx.fillText(gd, gearBounds.x + gearBounds.w / 2, gearBounds.y + gearBounds.h / 2)
      if (ovt) {
        const ofs = Math.round(fs * 0.18)
        ctx.fillStyle = PURPLE
        ctx.font = `bold ${ofs}px ${FS}`
        ctx.textBaseline = 'top'
        ctx.fillText('OVERTAKE', gearBounds.x + gearBounds.w / 2, gearBounds.y + 4)
      }
    }

    drawCell(ctx, cellBounds(4, 1), 'BB', frontBias.toFixed(1), ORANGE)
    drawCell(ctx, cellBounds(5, 1), 'LAP', lapCount.toString(), WHITE)

    // ── Row 2: AERO(0) | OT(1) | GEAR(cont 2-3) | SECTOR(4-5) ──
    drawCell(ctx, cellBounds(0, 2), 'AERO', aeroVal, aeroCol)
    drawCell(ctx, cellBounds(1, 2), 'OT', otVal, otCol, {
      sub: ovt ? 'ACTIVE' : '',
      subColor: otCol,
    })

    const secStr = lastSectorSplit ? `S${lastSectorSplit.sectorNumber}` : 'SEC'
    const secVal = lastSectorSplit ? formatLapTime(lastSectorSplit.time) : '--'
    const secCol =
      lastSectorSplit?.delta !== null && lastSectorSplit?.delta !== undefined
        ? lastSectorSplit.delta <= 0
          ? GREEN
          : RED
        : DIM
    drawCell(ctx, cellBounds(4, 2, 2, 1), secStr, secVal, secCol, { sizeFactor: 0.4 })

    // ── Row 3: FL(0) | FR(1) | status(2-3) | FL°(4) | FR°(5) ──
    drawCell(ctx, cellBounds(0, 3), '', `${Math.round(flLife)}`, wearCol(flW), {
      bg: TIRE_BG,
      labelColor: CYAN,
      sizeFactor: 0.55,
    })
    drawLabel(ctx, cellBounds(0, 3), 'FL', CYAN)
    drawCell(ctx, cellBounds(1, 3), '', `${Math.round(frLife)}`, wearCol(frW), {
      bg: TIRE_BG,
      sizeFactor: 0.55,
    })
    drawLabel(ctx, cellBounds(1, 3), 'FR', CYAN)

    const statusBounds = cellBounds(2, 3, 2, 1)
    strokeCell(ctx, statusBounds)
    {
      const fs = Math.round(Math.min(statusBounds.h * 0.35, 28))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = DIM
      ctx.font = `bold ${fs}px ${FS}`
      ctx.fillText(
        getPresetAbbreviation(ersPreset),
        statusBounds.x + statusBounds.w / 2,
        statusBounds.y + statusBounds.h / 2,
      )
    }

    {
      const b = cellBounds(4, 3)
      strokeCell(ctx, b)
      const fs = Math.round(Math.min(b.h * 0.45, 36))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = tireTempCol(flT)
      ctx.font = `bold ${fs}px ${FM}`
      ctx.fillText(`${tempToC(flT)}°`, b.x + b.w / 2, b.y + b.h * 0.45)
      drawSub(ctx, b, `${Math.round(flLife)}%`, GREEN)
    }
    {
      const b = cellBounds(5, 3)
      strokeCell(ctx, b)
      const fs = Math.round(Math.min(b.h * 0.45, 36))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = tireTempCol(frT)
      ctx.font = `bold ${fs}px ${FM}`
      ctx.fillText(`${tempToC(frT)}°`, b.x + b.w / 2, b.y + b.h * 0.45)
      drawSub(ctx, b, `${Math.round(frLife)}%`, GREEN)
    }

    // ── Row 4: RL(0) | RR(1) | BAT(2) | FUEL(3) | RL°(4) | RR°(5) ──
    drawCell(ctx, cellBounds(0, 4), '', `${Math.round(rlLife)}`, wearCol(rlW), {
      bg: TIRE_BG,
      sizeFactor: 0.55,
    })
    drawLabel(ctx, cellBounds(0, 4), 'RL', CYAN)
    drawCell(ctx, cellBounds(1, 4), '', `${Math.round(rrLife)}`, wearCol(rrW), {
      bg: TIRE_BG,
      sizeFactor: 0.55,
    })
    drawLabel(ctx, cellBounds(1, 4), 'RR', CYAN)

    drawCell(ctx, cellBounds(2, 4), 'BAT', `${Math.round(batteryCharge)}`, batCol)
    strokeCell(ctx, cellBounds(3, 4))

    {
      const b = cellBounds(4, 4)
      strokeCell(ctx, b)
      const fs = Math.round(Math.min(b.h * 0.45, 36))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = tireTempCol(rlT)
      ctx.font = `bold ${fs}px ${FM}`
      ctx.fillText(`${tempToC(rlT)}°`, b.x + b.w / 2, b.y + b.h * 0.45)
      drawSub(ctx, b, `${Math.round(rlLife)}%`, GREEN)
    }
    {
      const b = cellBounds(5, 4)
      strokeCell(ctx, b)
      const fs = Math.round(Math.min(b.h * 0.45, 36))
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = tireTempCol(rrT)
      ctx.font = `bold ${fs}px ${FM}`
      ctx.fillText(`${tempToC(rrT)}°`, b.x + b.w / 2, b.y + b.h * 0.45)
      drawSub(ctx, b, `${Math.round(rrLife)}%`, GREEN)
    }
  }
}
