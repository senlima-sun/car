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
import { renderNode, Row, Col, Text, type UINode } from './canvasUI'

const CW = 1280
const CH = 640
const MAX_RPM = 12500
const FLASH_DUR = 0.8

const FM = 'Consolas, "Courier New", monospace'
const FS = 'Arial, Helvetica, sans-serif'

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
const CYAN = '#06b6d4'

const PAD = 13
const RPM_H = 40
const BAT_H = 30
const ZONE_GAP = 8

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

const RPM_COLORS = [
  GREEN, GREEN, GREEN, GREEN, GREEN,
  YELLOW, YELLOW, YELLOW, YELLOW,
  RED, RED, RED,
  BLUE, BLUE, BLUE,
]
const RPM_SEGMENTS = RPM_COLORS.length

function drawRpmBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rpmRatio: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  rr(ctx, x, y, w, h, 4)
  ctx.fill()

  const segGap = 4
  const totalGaps = segGap * (RPM_SEGMENTS - 1)
  const segW = (w - totalGaps) / RPM_SEGMENTS
  const lit = Math.round(rpmRatio * RPM_SEGMENTS)

  for (let i = 0; i < RPM_SEGMENTS; i++) {
    const sx = x + i * (segW + segGap)
    rr(ctx, sx, y + 4, segW, h - 8, 3)
    if (i < lit) {
      ctx.fillStyle = RPM_COLORS[i]
      ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fill()
    }
  }
}

function drawBatteryBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, charge: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  rr(ctx, x, y, w, h, 4)
  ctx.fill()

  ctx.strokeStyle = BORDER
  ctx.lineWidth = 1
  rr(ctx, x, y, w, h, 4)
  ctx.stroke()

  const labelW = 60
  const pctW = 60
  const barX = x + labelW
  const barW = w - labelW - pctW
  const barPad = 5
  const fillW = Math.max(0, (barW - barPad * 2) * (charge / 100))

  const barCol = charge < 20 ? RED : charge < 50 ? ORANGE : GREEN

  if (fillW > 0) {
    rr(ctx, barX + barPad, y + barPad, fillW, h - barPad * 2, 2)
    ctx.fillStyle = barCol
    ctx.globalAlpha = 0.8
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.textBaseline = 'middle'
  ctx.font = `bold ${h * 0.45}px ${FS}`
  ctx.fillStyle = LABEL
  ctx.textAlign = 'center'
  ctx.fillText('SOC', x + labelW / 2, y + h / 2)

  ctx.font = `bold ${h * 0.5}px ${FM}`
  ctx.fillStyle = barCol
  ctx.textAlign = 'center'
  ctx.fillText(`${Math.round(charge)}%`, x + w - pctW / 2, y + h / 2)
}

function gridCell(label: string, value: string, color: string, sub?: string): UINode {
  if (sub) {
    return Col({ flex: 1, style: { background: CELL, borderRadius: 4, padding: 2 }, children: [
      Text(label, { flex: 1, fontSize: 0.45, color: LABEL, font: FS, bold: true }),
      Text(value, { flex: 2, fontSize: 0.7, color, font: FM, bold: true }),
      Text(sub, { flex: 0.8, fontSize: 0.4, color: LABEL, font: FS }),
    ]})
  }
  return Col({ flex: 1, style: { background: CELL, borderRadius: 4, padding: 2 }, children: [
    Text(label, { flex: 1, fontSize: 0.5, color: LABEL, font: FS, bold: true }),
    Text(value, { flex: 2, fontSize: 0.7, color, font: FM, bold: true }),
  ]})
}

function tireLifeCell(label: string, life: number, wear: number): UINode {
  return Col({ flex: 1, style: { background: `rgba(6,182,212,0.06)`, borderRadius: 4, padding: 2 }, children: [
    Text(label, { flex: 1, fontSize: 0.5, color: CYAN, font: FS, bold: true }),
    Text(`${Math.round(life)}`, { flex: 2, fontSize: 0.7, color: wearCol(wear), font: FM, bold: true }),
  ]})
}

function tireTempCell(label: string, tempNorm: number): UINode {
  return Col({ flex: 1, style: { background: `rgba(255,255,255,0.02)`, borderRadius: 4, padding: 2 }, children: [
    Text(label, { flex: 1, fontSize: 0.5, color: LABEL, font: FS, bold: true }),
    Text(`${tempToC(tempNorm)}`, { flex: 2, fontSize: 0.7, color: tireTempCol(tempNorm), font: FM, bold: true }),
  ]})
}

export function SteeringWheelDisplay() {
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
  const currentLapTime = useLapTimeStore(s => s.currentLapTime)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const currentLapStart = useLapTimeStore(s => s.currentLapStart)

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

  useFrame(state => {
    if (!screenCtx) return
    const ctx = screenCtx
    const t = state.clock.elapsedTime

    if (ersPreset !== prevPresetRef.current) {
      flashRef.current = t
      prevPresetRef.current = ersPreset
    }

    const flashing = flashRef.current !== null && t - flashRef.current < FLASH_DUR
    const ovt = ersMode === 'Overtake' || superClipActive

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, CW, CH)

    const rpmRatio = Math.min(1, rpm / MAX_RPM)
    drawRpmBar(ctx, PAD, PAD, CW - PAD * 2, RPM_H, rpmRatio)

    const gridY = PAD + RPM_H + ZONE_GAP
    const gridH = CH - PAD * 2 - RPM_H - BAT_H - ZONE_GAP * 2
    const tree = buildUI(ovt)
    renderNode(ctx, tree, { x: PAD, y: gridY, w: CW - PAD * 2, h: gridH })

    const batY = CH - PAD - BAT_H
    drawBatteryBar(ctx, PAD, batY, CW - PAD * 2, BAT_H, batteryCharge)

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

  function buildUI(ovt: boolean): UINode {
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

    const socVal = ({ Aggressive: '3', Balanced: '5', Conservative: '8' } as Record<string, string>)[ersPreset] ?? '5'
    const ebVal = ({ Low: '2', Medium: '5', High: '8' } as Record<string, string>)[engineBraking] ?? '5'
    const aeroVal = aeroMode === 'Corner' ? 'CRN' : 'STR'
    const aeroCol = aeroMode === 'Corner' ? BLUE : GREEN
    const otVal = ovt ? 'ON' : overtakeAvailable ? 'RDY' : 'OFF'
    const otCol = ovt ? PURPLE : overtakeAvailable ? YELLOW : DIM

    const flT = (tires.front_left_inner + tires.front_left_outer) / 2
    const frT = (tires.front_right_inner + tires.front_right_outer) / 2
    const rlT = (tires.rear_left_inner + tires.rear_left_outer) / 2
    const rrT = (tires.rear_right_inner + tires.rear_right_outer) / 2

    const flLife = Math.max(0, 100 - perWheelWear.frontLeft)
    const frLife = Math.max(0, 100 - perWheelWear.frontRight)
    const rlLife = Math.max(0, 100 - perWheelWear.rearLeft)
    const rrLife = Math.max(0, 100 - perWheelWear.rearRight)

    const bestStr = bestLapTime !== null ? formatLapTime(bestLapTime) : '-:--.---'

    return Col({ style: { gap: 4 }, children: [
      // Row 1: BEST | SPEED (2-wide) | DELTA
      Row({ flex: 0.8, style: { gap: 4 }, children: [
        gridCell('BEST', bestStr, GREEN),
        Col({ flex: 2, style: { background: CELL, borderRadius: 4 }, children: [
          Text('SPEED', { flex: 1, fontSize: 0.5, color: LABEL, font: FS, bold: true }),
          Text(Math.round(Math.abs(speed)).toString(), { flex: 2.5, fontSize: 0.75, color: SPEED_GREEN, font: FM, bold: true }),
        ]}),
        gridCell('DELTA', deltaStr, deltaCol),
      ]}),
      // Row 2-3: side cells + GEAR center
      Row({ flex: 2, style: { gap: 4 }, children: [
        // Left 2 cols
        Col({ flex: 1, style: { gap: 4 }, children: [
          Row({ flex: 1, style: { gap: 4 }, children: [
            gridCell('SOC', socVal, GREEN, getPresetAbbreviation(ersPreset)),
            gridCell('EB', ebVal, ORANGE, engineBraking),
          ]}),
          Row({ flex: 1, style: { gap: 4 }, children: [
            gridCell('AERO', aeroVal, aeroCol, aeroMode),
            gridCell('OT', otVal, otCol),
          ]}),
        ]}),
        // Center GEAR (2-wide)
        Col({ flex: 1, style: {
          background: ovt ? 'rgba(168,85,247,0.15)' : CELL,
          borderRadius: 4,
        }, children: [
          ...(ovt ? [
            Text('OVERTAKE', { flex: 0.15, fontSize: 0.55, color: PURPLE, font: FS, bold: true }),
          ] : []),
          Text(getGearDisplay(gear), {
            flex: 1, fontSize: 0.8, color: getGearColor(gear, rpm, MAX_RPM), font: FM, bold: true,
          }),
        ]}),
        // Right 2 cols
        Col({ flex: 1, style: { gap: 4 }, children: [
          Row({ flex: 1, style: { gap: 4 }, children: [
            gridCell('BB', frontBias.toFixed(1), ORANGE, `F${Math.round(frontBias)}`),
            gridCell('POS', '--', DIM),
          ]}),
          Row({ flex: 1, style: { gap: 4 }, children: [
            gridCell(
              lastSectorSplit ? `S${lastSectorSplit.sectorNumber}` : 'SEC',
              lastSectorSplit ? formatLapTime(lastSectorSplit.time) : '--',
              lastSectorSplit?.delta !== null && lastSectorSplit?.delta !== undefined
                ? (lastSectorSplit.delta <= 0 ? GREEN : RED)
                : DIM,
            ),
            gridCell('LAP', lapCount.toString(), WHITE),
          ]}),
        ]}),
      ]}),
      // Row 4: FL% | FR% | FLAG (2-wide) | FL° | FR°
      Row({ flex: 0.8, style: { gap: 4 }, children: [
        tireLifeCell('FL%', flLife, perWheelWear.frontLeft),
        tireLifeCell('FR%', frLife, perWheelWear.frontRight),
        Col({ flex: 2, style: { background: CELL, borderRadius: 4, padding: 2 }, children: [
          Text('FLAG', { flex: 1, fontSize: 0.5, color: LABEL, font: FS, bold: true }),
          Text('--', { flex: 2, fontSize: 0.7, color: DIM, font: FM, bold: true }),
        ]}),
        tireTempCell('FL°', flT),
        tireTempCell('FR°', frT),
      ]}),
      // Row 5: RL% | RR% | BAT | FUEL | RL° | RR°
      Row({ flex: 0.8, style: { gap: 4 }, children: [
        tireLifeCell('RL%', rlLife, perWheelWear.rearLeft),
        tireLifeCell('RR%', rrLife, perWheelWear.rearRight),
        gridCell('BAT', `${Math.round(batteryCharge)}`, batteryCharge < 20 ? RED : batteryCharge < 50 ? ORANGE : GREEN),
        gridCell('FUEL', '--', DIM),
        tireTempCell('RL°', rlT),
        tireTempCell('RR°', rrT),
      ]}),
    ]})
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
