import { useCarStore } from '@/stores/useCarStore'
import { useErsStore } from '@/stores/useErsStore'
import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { useBrakeStore } from '@/stores/useBrakeStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useFPSStore } from '@/stores/useFPSStore'
import { useTireStore } from '@/stores/useTireStore'
import { useTemperatureStore } from '@/stores/useTemperatureStore'
import { TIRE_CONFIG } from '@/constants/tires'
import { engineTempToCelsius } from '@/wasm/PhysicsBridge'
import {
  formatLapTime,
  getBatteryColor,
  getModeAbbreviation,
  getAeroAbbreviation,
  getModeColor,
  getAeroColor,
  getGearDisplay,
  getGearColor,
  getFPSColor,
  getEngineTempColor,
  getTireWearColor,
  getEngineBrakingAbbrev,
  getEngineBrakingColor,
} from '@/utils/steeringDisplayHelpers'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CANVAS_WIDTH = 1024
const CANVAS_HEIGHT = 512
const MAX_RPM = 12500

export function SteeringWheelDisplay() {
  const speed = useCarStore(state => state.speed)
  const gear = useCarStore(state => state.gear)
  const rpm = useCarStore(state => state.rpm)
  const ersCharge = useErsStore(state => state.batteryCharge)
  const ersMode = useErsStore(state => state.mode)
  const aeroMode = useActiveAeroStore(state => state.mode)
  const brakeBias = useBrakeStore(state => state.frontBias)
  const engineBraking = useBrakeStore(state => state.engineBraking)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)
  const fps = useFPSStore(state => state.fps)
  const currentCompound = useTireStore(state => state.currentCompound)
  const averageWear = useTireStore(state => state.averageWear)
  const engineTemperature = useTemperatureStore(state => state.engine.temperature)

  const canvasRef = useRef(document.createElement('canvas'))
  const textureRef = useRef<THREE.CanvasTexture>(null!)

  const screenContext = useMemo(() => {
    const canvas = canvasRef.current
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    return canvas.getContext('2d')
  }, [])

  useFrame(() => {
    if (!screenContext) return

    const ctx = screenContext
    const w = CANVAS_WIDTH
    const h = CANVAS_HEIGHT

    // 1. Base UI
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#444'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, w, h)

    // --- Top Left: Engine Temp ---
    ctx.textAlign = 'left'
    ctx.fillStyle = getEngineTempColor(engineTemperature)
    ctx.font = 'bold 30px Arial'
    ctx.fillText(`ENG ${Math.round(engineTempToCelsius(engineTemperature))}°C`, 30, 30)

    // --- Top Right: FPS ---
    ctx.textAlign = 'right'
    ctx.fillStyle = getFPSColor(fps)
    ctx.font = 'bold 30px Arial'
    ctx.fillText(`${Math.round(fps)} FPS`, w - 30, 30)

    // --- Center: Gear & Speed ---
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = getGearColor(gear, rpm, MAX_RPM)
    ctx.font = 'bold 250px Arial'
    ctx.fillText(getGearDisplay(gear), w / 2, h / 2 - 20)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 100px Arial'
    ctx.fillText(Math.round(speed).toString(), w / 2, h / 2 + 120)

    // --- Left Column: ERS, Lap Time, Tire Info ---
    ctx.textAlign = 'left'
    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 32px Arial'
    ctx.fillText('ERS', 30, 80)

    ctx.fillStyle = getBatteryColor(ersCharge)
    ctx.font = 'bold 70px Arial'
    ctx.fillText(`${Math.round(ersCharge)}%`, 30, 130)

    ctx.fillStyle = getModeColor(ersMode)
    ctx.font = 'bold 50px Arial'
    ctx.fillText(getModeAbbreviation(ersMode), 30, 190)

    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 32px Arial'
    ctx.fillText('LAP', 30, h - 150)
    ctx.fillStyle = '#00ff88'
    ctx.font = 'bold 60px Arial'
    ctx.fillText(formatLapTime(currentLapTime), 30, h - 100)

    // Tire Compound and Wear
    const tireConfig = TIRE_CONFIG[currentCompound]
    ctx.fillStyle = tireConfig.color
    ctx.font = 'bold 50px Arial'
    ctx.fillText(tireConfig.icon, 50, h - 50)
    ctx.fillStyle = getTireWearColor(averageWear)
    ctx.font = 'bold 30px Arial'
    ctx.fillText(`${Math.round(100 - averageWear)}%`, 100, h - 50)

    // --- Right Column: Aero, Brakes, Engine Braking ---
    ctx.textAlign = 'right'
    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 32px Arial'
    ctx.fillText('AERO', w - 30, 80)

    ctx.fillStyle = getAeroColor(aeroMode)
    ctx.font = 'bold 50px Arial'
    ctx.fillText(getAeroAbbreviation(aeroMode), w - 30, 130)

    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 32px Arial'
    ctx.fillText('BIAS', w - 30, h - 150)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 50px Arial'
    ctx.fillText(`${Math.round(brakeBias)} / ${Math.round(100 - brakeBias)}`, w - 30, h - 100)

    // Engine Braking
    ctx.fillStyle = getEngineBrakingColor(engineBraking)
    ctx.font = 'bold 30px Arial'
    ctx.fillText(`EB ${getEngineBrakingAbbrev(engineBraking)}`, w - 30, h - 50)

    // --- Bottom: RPM Bar ---
    const rpmRatio = rpm / MAX_RPM
    const barWidth = w - 60
    ctx.fillStyle = '#222'
    ctx.fillRect(30, h - 30, barWidth, 20)
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(30, h - 30, barWidth * rpmRatio, 20)

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
