import { useCarStore } from '@/stores/useCarStore'
import { useErsStore } from '@/stores/useErsStore'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import {
  formatLapTime,
  getBatteryColor,
  getAeroAbbreviation,
  getAeroColor,
  getGearDisplay,
  getGearColor,
  getPresetAbbreviation,
  getPresetColor,
} from '@/utils/steeringDisplayHelpers'
import { UI } from '@/constants/colors'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CANVAS_WIDTH = 1024
const CANVAS_HEIGHT = 512
const MAX_RPM = 12500
const FLASH_DURATION = 1.0 // seconds

export function SteeringWheelDisplay() {
  const speed = useCarStore(state => state.speed)
  const gear = useCarStore(state => state.gear)
  const rpm = useCarStore(state => state.rpm)
  const ersCharge = useErsStore(state => state.batteryCharge)
  const ersPreset = useErsStore(state => state.semiAutoConfig.preset)
  const aeroMode = useActiveAeroStore(state => state.mode)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)
  const isRecording = useLapTimeStore(state => state.isRecording)

  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef<THREE.CanvasTexture>(null!)

  // ERS preset flash tracking
  const previousPresetRef = useRef(ersPreset)
  const flashStartTimeRef = useRef<number | null>(null)

  const screenContext = useMemo(() => {
    const canvas = canvasRef.current
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    return canvas.getContext('2d')
  }, [])

  useFrame((state) => {
    if (!screenContext) return

    const ctx = screenContext
    const w = CANVAS_WIDTH
    const h = CANVAS_HEIGHT
    const currentTime = state.clock.elapsedTime

    // Detect ERS preset change
    if (ersPreset !== previousPresetRef.current) {
      flashStartTimeRef.current = currentTime
      previousPresetRef.current = ersPreset
    }

    // Calculate flash state
    const isFlashing = flashStartTimeRef.current !== null &&
      (currentTime - flashStartTimeRef.current) < FLASH_DURATION

    // 1. Base UI - black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    // If flashing, show full-screen ERS preset overlay
    if (isFlashing) {
      const flashAlpha = 1 - ((currentTime - flashStartTimeRef.current!) / FLASH_DURATION)
      const presetColor = getPresetColor(ersPreset)

      // Semi-transparent colored background
      ctx.fillStyle = presetColor
      ctx.globalAlpha = 0.3 * flashAlpha
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1

      // Large centered preset text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = presetColor
      ctx.font = 'bold 180px Arial'
      ctx.fillText(`${getPresetAbbreviation(ersPreset)} ERS`, w / 2, h / 2)

      // Update the texture and return early
      if (textureRef.current) {
        textureRef.current.needsUpdate = true
      }
      return
    }

    // --- Left: Vertical Battery Bar ---
    const barX = 40
    const barY = 60
    const barWidth = 50
    const barHeight = h - 140
    const chargeRatio = ersCharge / 100

    // Battery bar background
    ctx.fillStyle = UI.surface
    ctx.fillRect(barX, barY, barWidth, barHeight)

    // Battery bar fill (from bottom up)
    const fillHeight = barHeight * chargeRatio
    ctx.fillStyle = getBatteryColor(ersCharge)
    ctx.fillRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight)

    // Battery bar border
    ctx.strokeStyle = '#666'
    ctx.lineWidth = 3
    ctx.strokeRect(barX, barY, barWidth, barHeight)

    // Battery percentage below bar
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = getBatteryColor(ersCharge)
    ctx.font = 'bold 36px Arial'
    ctx.fillText(`${Math.round(ersCharge)}%`, barX + barWidth / 2, barY + barHeight + 10)

    // ERS Preset label below percentage
    ctx.fillStyle = getPresetColor(ersPreset)
    ctx.font = 'bold 48px Arial'
    ctx.fillText(getPresetAbbreviation(ersPreset), barX + barWidth / 2, h - 35)

    // --- Center: Gear & Speed ---
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = getGearColor(gear, rpm, MAX_RPM)
    ctx.font = 'bold 320px Arial'
    ctx.fillText(getGearDisplay(gear), w / 2, h / 2 - 40)

    ctx.fillStyle = UI.textPrimary
    ctx.font = 'bold 120px Arial'
    ctx.fillText(Math.round(speed).toString(), w / 2, h / 2 + 140)

    // "km/h" label
    ctx.fillStyle = UI.textSecondary
    ctx.font = 'bold 40px Arial'
    ctx.fillText('km/h', w / 2, h / 2 + 190)

    // --- Right Column: Aero & Lap Time ---
    ctx.textAlign = 'right'

    // Aero mode
    ctx.fillStyle = UI.textSecondary
    ctx.font = 'bold 40px Arial'
    ctx.fillText('AERO', w - 40, 50)

    ctx.fillStyle = getAeroColor(aeroMode)
    ctx.font = 'bold 64px Arial'
    ctx.fillText(getAeroAbbreviation(aeroMode), w - 40, 110)

    // Lap time with recording indicator
    ctx.fillStyle = UI.textSecondary
    ctx.font = 'bold 40px Arial'
    ctx.fillText('LAP', w - 40, h - 130)

    // Recording indicator (blinking red dot + REC)
    if (isRecording) {
      const blinkOn = Math.floor(currentTime * 2) % 2 === 0
      if (blinkOn) {
        // Red dot
        ctx.beginPath()
        ctx.arc(w - 170, h - 120, 12, 0, Math.PI * 2)
        ctx.fillStyle = '#ff0000'
        ctx.fill()
      }
      // REC text
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ff0000'
      ctx.font = 'bold 32px Arial'
      ctx.fillText('REC', w - 190, h - 112)
    }

    ctx.textAlign = 'right'
    ctx.fillStyle = UI.textPrimary
    ctx.font = 'bold 72px Arial'
    ctx.fillText(formatLapTime(currentLapTime), w - 40, h - 70)

    // Update the texture
    if (textureRef.current) {
      textureRef.current.needsUpdate = true
    }
  })

  return (
    <mesh position={[0, 0, 0.006]}>
      <planeGeometry args={[0.2, 0.1]} />
      <meshBasicMaterial>
        <canvasTexture ref={textureRef} attach='map' image={canvasRef.current} premultiplyAlpha />
      </meshBasicMaterial>
    </mesh>
  )
}
