import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { useBrakeStore } from '@/stores/useBrakeStore'
import { useCarStore } from '@/stores/useCarStore'
import { useErsStore } from '@/stores/useErsStore'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { getSwDisplay } from '@/stores/useSwDisplayStore'
import { useTemperatureStore } from '@/stores/useTemperatureStore'
import { useTireStore } from '@/stores/useTireStore'
import type { EngineBrakingLevel, SemiAutoPreset } from '@/wasm/PhysicsBridge'
import {
  formatLapTime,
  getGearColor,
  getGearDisplay,
  getPresetAbbreviation,
  getPresetColor,
} from '@/utils/steeringDisplayHelpers'
import {
  BLUE,
  CH,
  CW,
  CYAN,
  DIM,
  FLASH_DUR,
  FM,
  FS,
  GREEN,
  MAX_RPM,
  ORANGE,
  PURPLE,
  RED,
  SPEED_GREEN,
  TIRE_BG,
  WHITE,
  YELLOW,
} from './constants'
import { drawBatteryBar } from './drawing/batteryBar'
import { drawCell, drawLabel, drawTireTempCell, strokeCell } from './drawing/cell'
import { cellBounds, wearCol } from './helpers'

const SOC_BY_PRESET: Record<SemiAutoPreset, string> = {
  Aggressive: '3',
  Balanced: '5',
  Conservative: '8',
}

const EB_BY_LEVEL: Record<EngineBrakingLevel, string> = {
  Low: '2',
  Medium: '5',
  High: '8',
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

  const { canvas, texture } = getSwDisplay()
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

    const socVal = SOC_BY_PRESET[ersPreset]
    const ebVal = EB_BY_LEVEL[engineBraking]
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

    drawCell(ctx, cellBounds(0, 0, 2, 1), 'BEST', bestStr, GREEN, { sizeFactor: 0.45 })
    drawCell(ctx, cellBounds(2, 0, 2, 1), '', Math.round(Math.abs(speed)).toString(), SPEED_GREEN, {
      sizeFactor: 0.6,
    })
    drawCell(ctx, cellBounds(4, 0, 2, 1), 'DELTA', deltaStr, deltaCol, { sizeFactor: 0.5 })

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

    drawTireTempCell(ctx, cellBounds(4, 3), flT, flLife)
    drawTireTempCell(ctx, cellBounds(5, 3), frT, frLife)

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

    drawTireTempCell(ctx, cellBounds(4, 4), rlT, rlLife)
    drawTireTempCell(ctx, cellBounds(5, 4), rrT, rrLife)
  }
}

