import { useState, useEffect, useRef, useCallback } from 'react'

interface GyroscopeState {
  steer: number
  rawGamma: number
  isCalibrated: boolean
  isSupported: boolean
  needsPermission: boolean
}

interface CalibrationData {
  centerGamma: number
  maxAngle: number
}

const DEAD_ZONE = 3
const MAX_STEER_ANGLE = 45
const SMOOTHING_ALPHA = 0.8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function useGyroscope() {
  const [state, setState] = useState<GyroscopeState>({
    steer: 0,
    rawGamma: 0,
    isCalibrated: false,
    isSupported: typeof DeviceOrientationEvent !== 'undefined',
    needsPermission: typeof (DeviceOrientationEvent as any).requestPermission === 'function',
  })

  const calibrationRef = useRef<CalibrationData | null>(null)
  const smoothedRef = useRef(0)
  const listenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null)

  const loadCalibration = useCallback((): CalibrationData | null => {
    try {
      const saved = localStorage.getItem('controller-calibration')
      if (saved) return JSON.parse(saved)
    } catch {}
    return null
  }, [])

  const saveCalibration = useCallback((data: CalibrationData) => {
    localStorage.setItem('controller-calibration', JSON.stringify(data))
  }, [])

  const calibrate = useCallback(() => {
    const data: CalibrationData = {
      centerGamma: smoothedRef.current,
      maxAngle: MAX_STEER_ANGLE,
    }
    calibrationRef.current = data
    saveCalibration(data)
    setState(s => ({ ...s, isCalibrated: true }))
  }, [saveCalibration])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const result = await (DeviceOrientationEvent as any).requestPermission()
        return result === 'granted'
      } catch {
        return false
      }
    }
    return true
  }, [])

  const start = useCallback(async () => {
    if (state.needsPermission) {
      const granted = await requestPermission()
      if (!granted) return
    }

    const saved = loadCalibration()
    if (saved) {
      calibrationRef.current = saved
      setState(s => ({ ...s, isCalibrated: true }))
    }

    const handler = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma ?? 0
      smoothedRef.current = SMOOTHING_ALPHA * smoothedRef.current + (1 - SMOOTHING_ALPHA) * gamma

      const cal = calibrationRef.current
      if (!cal) {
        setState(s => ({ ...s, rawGamma: smoothedRef.current }))
        return
      }

      let adjusted = smoothedRef.current - cal.centerGamma
      if (Math.abs(adjusted) < DEAD_ZONE) adjusted = 0
      else adjusted = adjusted > 0 ? adjusted - DEAD_ZONE : adjusted + DEAD_ZONE

      const normalized = clamp(adjusted / (cal.maxAngle - DEAD_ZONE), -1, 1)
      setState(s => ({ ...s, steer: normalized, rawGamma: smoothedRef.current }))
    }

    listenerRef.current = handler
    window.addEventListener('deviceorientation', handler)
  }, [state.needsPermission, requestPermission, loadCalibration])

  const stop = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener('deviceorientation', listenerRef.current)
      listenerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { ...state, start, stop, calibrate, requestPermission }
}
