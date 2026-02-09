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

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CW = 1280
const CH = 640
const MAX_RPM = 12500
const FLASH_DUR = 0.8

const FM = 'Consolas, "Courier New", monospace'
const FS = 'Arial, Helvetica, sans-serif'

const BG = '#050505'
const CELL = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.06)'
const DIM = 'rgba(255,255,255,0.15)'
const LABEL = 'rgba(255,255,255,0.45)'
const WHITE = '#ffffff'
const GREEN = '#22c55e'
const RED = '#ef4444'
const YELLOW = '#eab308'
const BLUE = '#3b82f6'
const PURPLE = '#a855f7'
const ORANGE = '#f97316'
const SPEED_GREEN = '#00ff88'

// --- Proportional layout ratios ---
const PAD = 0.01          // padding as % of canvas
const GAP = 0.008         // gap between panels

// Vertical row ratios (must sum to 1)
const TOP_R = 0.17        // top info bar
const BOT_R = 0            // bottom resource bar (removed)

// Horizontal column ratios for middle row (must sum to 1)
const SIDE_R = 0.18       // left & right columns
const CENTER_R = 1 - SIDE_R * 2  // center (gear + telemetry)

// Center vertical split: gear vs telemetry
const GEAR_R = 0.55       // gear takes 55% of center height
const TEL_R = 0.45        // telemetry takes 45%

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const cr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + cr)
  ctx.lineTo(x + w, y + h - cr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h)
  ctx.lineTo(x + cr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - cr)
  ctx.lineTo(x, y + cr)
  ctx.quadraticCurveTo(x, y, x + cr, y)
  ctx.closePath()
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(ctx, x, y, w, h, 8)
  ctx.fillStyle = BG
  ctx.fill()
  ctx.strokeStyle = BORDER
  ctx.lineWidth = 2
  ctx.stroke()
}

function cell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(ctx, x, y, w, h, 6)
  ctx.fillStyle = CELL
  ctx.fill()
}

function sep(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number) {
  ctx.strokeStyle = BORDER
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y1)
  ctx.lineTo(x, y2)
  ctx.stroke()
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

export function SteeringWheelDisplay() {
  const speed = useCarStore(s => s.speed)
  const gear = useCarStore(s => s.gear)
  const rpm = useCarStore(s => s.rpm)

  const ersPreset = useErsStore(s => s.semiAutoConfig.preset)
  const ersMode = useErsStore(s => s.mode)
  const superClipActive = useErsStore(s => s.superClipActive)
  const overtakeAvailable = useErsStore(s => s.overtakeAvailable)

  const aeroMode = useActiveAeroStore(s => s.mode)

  const currentLapTime = useLapTimeStore(s => s.currentLapTime)
  const bestLapTime = useLapTimeStore(s => s.bestLapTime)
  const lastLapTime = useLapTimeStore(s => s.lastLapTime)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const lastSectorSplit = useLapTimeStore(s => s.lastSectorSplit)

  const perWheelWear = useTireStore(s => s.perWheelWear)

  const frontBias = useBrakeStore(s => s.frontBias)
  const engineBraking = useBrakeStore(s => s.engineBraking)

  const tires = useTemperatureStore(s => s.tires)

  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef<THREE.CanvasTexture>(null!)
  const prevPresetRef = useRef(ersPreset)
  const flashRef = useRef<number | null>(null)

  const screenCtx = useMemo(() => {
    const c = canvasRef.current
    c.width = CW
    c.height = CH
    return c.getContext('2d')
  }, [])

  useFrame((state) => {
    if (!screenCtx) return
    const ctx = screenCtx
    const t = state.clock.elapsedTime

    if (ersPreset !== prevPresetRef.current) {
      flashRef.current = t
      prevPresetRef.current = ersPreset
    }

    const flashing = flashRef.current !== null && (t - flashRef.current) < FLASH_DUR
    const ovt = ersMode === 'Overtake' || superClipActive

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, CW, CH)

    drawUI(ctx, t, ovt)

    if (flashing) {
      const a = 1 - (t - flashRef.current!) / FLASH_DUR
      const pc = getPresetColor(ersPreset)
      ctx.save()
      ctx.globalAlpha = a
      ctx.strokeStyle = pc
      ctx.lineWidth = 16 * a
      rr(ctx, 6, 6, CW - 12, CH - 12, 12)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = pc
      ctx.font = `bold ${CH * 0.18}px ${FS}`
      ctx.fillText(`${getPresetAbbreviation(ersPreset)} ERS`, CW / 2, CH / 2)
      ctx.restore()
    }

    if (ovt) {
      const pa = 0.35 + Math.sin(t * 8) * 0.25
      ctx.save()
      ctx.globalAlpha = pa
      ctx.strokeStyle = PURPLE
      ctx.lineWidth = 8
      rr(ctx, 3, 3, CW - 6, CH - 6, 12)
      ctx.stroke()
      ctx.restore()
    }

    if (textureRef.current) textureRef.current.needsUpdate = true
  })

  function drawUI(ctx: CanvasRenderingContext2D, t: number, ovt: boolean) {
    ctx.textBaseline = 'middle'

    const p = CW * PAD
    const g = CW * GAP

    // Available area after padding
    const aw = CW - p * 2
    const ah = CH - p * 2

    // Row heights (proportional)
    const topH = ah * TOP_R
    const botH = ah * BOT_R
    const midH = ah - topH - botH - g * 2

    // Column widths (proportional)
    const sideW = aw * SIDE_R
    const centerW = aw * CENTER_R - g * 2

    // Positions
    const topY = p
    const midY = topY + topH + g
    const botY = CH - p - botH

    const lx = p
    const cx = lx + sideW + g
    const rx = cx + centerW + g

    // Center vertical split
    const gearH = (midH - g) * GEAR_R
    const telH = (midH - g) * TEL_R
    const telY = midY + gearH + g

    // ============================================================
    // TOP ROW: Speed | Lap Time | Delta (3 equal columns)
    // ============================================================
    panel(ctx, lx, topY, aw, topH)

    const tcy = topY + topH / 2
    const topColW = aw / 3
    const topFontBig = topH * 0.6
    const topFontSm = topH * 0.26

    // Speed (left third)
    const speedCx = lx + topColW * 0.5
    ctx.textAlign = 'center'
    ctx.fillStyle = SPEED_GREEN
    ctx.font = `bold ${topFontBig}px ${FM}`
    ctx.fillText(Math.round(Math.abs(speed)).toString(), speedCx - topColW * 0.08, tcy)
    ctx.fillStyle = LABEL
    ctx.font = `bold ${topFontSm}px ${FS}`
    ctx.fillText('km/h', speedCx + topColW * 0.32, tcy)

    sep(ctx, lx + topColW, topY + topH * 0.15, topY + topH * 0.85)

    // Lap time (center third)
    const lapCx = lx + topColW * 1.5
    ctx.textAlign = 'center'
    ctx.fillStyle = WHITE
    ctx.font = `bold ${topFontBig}px ${FM}`
    ctx.fillText(formatLapTime(currentLapTime), lapCx, tcy)

    if (isRecording) {
      if (Math.floor(t * 2) % 2 === 0) {
        ctx.beginPath()
        ctx.arc(lapCx - topColW * 0.42, tcy, topH * 0.08, 0, Math.PI * 2)
        ctx.fillStyle = RED
        ctx.fill()
      }
    }

    sep(ctx, lx + topColW * 2, topY + topH * 0.15, topY + topH * 0.85)

    // Delta (right third)
    const deltaCx = lx + topColW * 2.5
    let deltaStr = '-.--'
    let deltaCol = DIM
    if (lastSectorSplit?.delta !== null && lastSectorSplit?.delta !== undefined) {
      const d = lastSectorSplit.delta
      deltaStr = `${d <= 0 ? '-' : '+'}${Math.abs(d / 1000).toFixed(2)}`
      deltaCol = d <= 0 ? GREEN : RED
    } else if (lastLapTime !== null && bestLapTime !== null) {
      const d = lastLapTime - bestLapTime
      deltaStr = `${d <= 0 ? '-' : '+'}${Math.abs(d / 1000).toFixed(2)}`
      deltaCol = d <= 0 ? GREEN : RED
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = LABEL
    ctx.font = `bold ${topH * 0.2}px ${FS}`
    ctx.fillText('DELTA', deltaCx, tcy - topH * 0.2)
    ctx.fillStyle = deltaCol
    ctx.font = `bold ${topH * 0.48}px ${FM}`
    ctx.fillText(deltaStr, deltaCx, tcy + topH * 0.1)

    // ============================================================
    // LEFT COLUMN: SOC | EB | AERO | OT (4 equal rows)
    // ============================================================
    panel(ctx, lx, midY, sideW, midH)
    drawSettingsColumn(ctx, lx, midY, sideW, midH, 'left', ovt)

    // ============================================================
    // CENTER TOP: GEAR
    // ============================================================
    panel(ctx, cx, midY, centerW, gearH)

    const gcx = cx + centerW / 2
    const gcy = midY + gearH / 2

    if (ovt) {
      rr(ctx, cx + 4, midY + 4, centerW - 8, gearH - 8, 8)
      ctx.fillStyle = 'rgba(168,85,247,0.1)'
      ctx.fill()
      ctx.textAlign = 'center'
      ctx.fillStyle = PURPLE
      ctx.font = `bold ${gearH * 0.12}px ${FS}`
      ctx.fillText('OVERTAKE', gcx, midY + gearH * 0.12)
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = getGearColor(gear, rpm, MAX_RPM)
    ctx.font = `bold ${gearH * 0.75}px ${FM}`
    ctx.fillText(getGearDisplay(gear), gcx, gcy + gearH * 0.04)

    // ============================================================
    // CENTER BOTTOM: Telemetry — tire temps + wear + brake temp
    // ============================================================
    panel(ctx, cx, telY, centerW, telH)
    drawTelemetry(ctx, cx, telY, centerW, telH)

    // ============================================================
    // RIGHT COLUMN: BB | POS | DIFF | LAP
    // ============================================================
    panel(ctx, rx, midY, sideW, midH)
    drawSettingsColumn(ctx, rx, midY, sideW, midH, 'right', ovt)

    // Bottom row removed (RPM shown via LED lights)
  }

  function drawSettingsColumn(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    side: 'left' | 'right',
    ovt: boolean,
  ) {
    const rowH = h / 4
    const inset = w * 0.06
    const cellW = w - inset * 2
    const cellH = rowH - inset

    const labelSize = Math.round(rowH * 0.22)
    const valueSize = Math.round(rowH * 0.45)
    const subSize = Math.round(rowH * 0.16)

    type Row = { lbl: string; v: string; vc: string; sub?: string }
    const rows: Row[] = side === 'left'
      ? [
        { lbl: 'SOC', v: ({ Aggressive: '3', Balanced: '5', Conservative: '8' }[ersPreset]) ?? '5', vc: GREEN, sub: getPresetAbbreviation(ersPreset) },
        { lbl: 'EB', v: ({ Low: '2', Medium: '5', High: '8' }[engineBraking]) ?? '5', vc: ORANGE, sub: engineBraking },
        { lbl: 'AERO', v: aeroMode === 'Corner' ? 'CRN' : 'STR', vc: aeroMode === 'Corner' ? BLUE : GREEN, sub: aeroMode },
        { lbl: 'OT', v: ovt ? 'ON' : overtakeAvailable ? 'RDY' : 'OFF', vc: ovt ? PURPLE : overtakeAvailable ? YELLOW : DIM },
      ]
      : [
        { lbl: 'BB', v: frontBias.toFixed(1), vc: ORANGE, sub: `F${Math.round(frontBias)} R${Math.round(100 - frontBias)}` },
        { lbl: 'POS', v: '--', vc: DIM },
        { lbl: 'DIFF', v: '--', vc: DIM },
        { lbl: 'LAP', v: lapCount.toString(), vc: WHITE },
      ]

    for (let i = 0; i < 4; i++) {
      const ry = y + rowH * i
      const rcy = ry + rowH / 2
      const { lbl, v, vc, sub } = rows[i]

      cell(ctx, x + inset, ry + inset / 2, cellW, cellH)

      const hasSub = !!sub
      const vOff = hasSub ? -rowH * 0.06 : 0

      ctx.textAlign = 'left'
      ctx.fillStyle = LABEL
      ctx.font = `bold ${labelSize}px ${FS}`
      ctx.fillText(lbl, x + inset + w * 0.08, rcy + vOff)

      ctx.textAlign = 'right'
      ctx.fillStyle = vc
      ctx.font = `bold ${valueSize}px ${FM}`
      ctx.fillText(v, x + w - inset - w * 0.06, rcy + vOff)

      if (hasSub) {
        ctx.textAlign = 'right'
        ctx.fillStyle = LABEL
        ctx.font = `${subSize}px ${FS}`
        ctx.fillText(sub, x + w - inset - w * 0.06, rcy + rowH * 0.24)
      }
    }
  }

  function drawTelemetry(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
  ) {
    const cy = y + h / 2

    // Layout: 4 wheels (70%) | separator | brake (20%) | padding
    const wheelsW = w * 0.7
    const brkW = w * 0.2

    // 4 wheels
    const flT = (tires.front_left_inner + tires.front_left_outer) / 2
    const frT = (tires.front_right_inner + tires.front_right_outer) / 2
    const rlT = (tires.rear_left_inner + tires.rear_left_outer) / 2
    const rrT = (tires.rear_right_inner + tires.rear_right_outer) / 2

    const wheels = [
      { l: 'FL', tp: flT, wr: perWheelWear.frontLeft },
      { l: 'FR', tp: frT, wr: perWheelWear.frontRight },
      { l: 'RL', tp: rlT, wr: perWheelWear.rearLeft },
      { l: 'RR', tp: rrT, wr: perWheelWear.rearRight },
    ]

    const wheelStartX = x + w * 0.05
    const wheelColW = wheelsW / 4
    const wLabelSize = h * 0.2
    const wTempSize = h * 0.36
    const wWearSize = h * 0.22

    for (let i = 0; i < 4; i++) {
      const wcx = wheelStartX + wheelColW * (i + 0.5)
      const { l, tp, wr } = wheels[i]
      const life = Math.max(0, 100 - wr)

      // Wheel cell background
      cell(ctx, wheelStartX + wheelColW * i + 4, y + 4, wheelColW - 8, h - 8)

      ctx.textAlign = 'center'

      ctx.fillStyle = LABEL
      ctx.font = `bold ${wLabelSize}px ${FS}`
      ctx.fillText(l, wcx, cy - h * 0.3)

      ctx.fillStyle = tireTempCol(tp)
      ctx.font = `bold ${wTempSize}px ${FM}`
      ctx.fillText(`${tempToC(tp)}`, wcx, cy + h * 0.02)

      ctx.fillStyle = wearCol(wr)
      ctx.font = `bold ${wWearSize}px ${FM}`
      ctx.fillText(`${Math.round(life)}%`, wcx, cy + h * 0.32)
    }

    // Separator
    const sepX = x + w * 0.05 + wheelsW + 4
    sep(ctx, sepX, y + h * 0.12, y + h * 0.88)

    // Brake temp placeholder
    const brkCx = sepX + brkW / 2
    ctx.textAlign = 'center'
    ctx.fillStyle = LABEL
    ctx.font = `bold ${h * 0.2}px ${FS}`
    ctx.fillText('BRK', brkCx, cy - h * 0.2)
    ctx.fillStyle = DIM
    ctx.font = `bold ${h * 0.34}px ${FM}`
    ctx.fillText('--', brkCx, cy + h * 0.1)
  }

  return (
    <mesh position={[0, 0, 0.006]}>
      <planeGeometry args={[0.26, 0.135]} />
      <meshBasicMaterial>
        <canvasTexture ref={textureRef} attach='map' image={canvasRef.current} premultiplyAlpha />
      </meshBasicMaterial>
    </mesh>
  )
}
