import { useRef, useCallback, useSyncExternalStore } from 'react'

interface CalibrationData {
  centerGamma: number
  maxAngle: number
}

interface GyroSnapshot {
  steer: number
  rawGamma: number
  isCalibrated: boolean
}

const DEAD_ZONE = 3
const MAX_STEER_ANGLE = 45
const SMOOTHING_ALPHA = 0.8

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

let _snapshot: GyroSnapshot = { steer: 0, rawGamma: 0, isCalibrated: false }
let _listeners = new Set<() => void>()
let _smoothed = 0
let _calibration: CalibrationData | null = null
let _listening = false

function emit() {
  for (const fn of _listeners) fn()
}

function handleOrientation(e: DeviceOrientationEvent) {
  const gamma = e.gamma ?? 0
  _smoothed = SMOOTHING_ALPHA * _smoothed + (1 - SMOOTHING_ALPHA) * gamma

  if (!_calibration) {
    _snapshot = { steer: 0, rawGamma: _smoothed, isCalibrated: false }
    emit()
    return
  }

  let adjusted = _smoothed - _calibration.centerGamma
  if (Math.abs(adjusted) < DEAD_ZONE) adjusted = 0
  else adjusted = adjusted > 0 ? adjusted - DEAD_ZONE : adjusted + DEAD_ZONE

  const normalized = clamp(adjusted / (_calibration.maxAngle - DEAD_ZONE), -1, 1)
  _snapshot = { steer: normalized, rawGamma: _smoothed, isCalibrated: true }
  emit()
}

function subscribe(fn: () => void) {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

function getSnapshot() {
  return _snapshot
}

export function useGyroscope() {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const needsPermission = typeof (DeviceOrientationEvent as any).requestPermission === 'function'

  const requestPermissionAndStart = useCallback(async () => {
    if (needsPermission) {
      try {
        const result = await (DeviceOrientationEvent as any).requestPermission()
        if (result !== 'granted') return false
      } catch {
        return false
      }
    }
    if (!_listening) {
      const saved = loadCalibration()
      if (saved) _calibration = saved
      window.addEventListener('deviceorientation', handleOrientation)
      _listening = true
    }
    return true
  }, [needsPermission])

  const calibrate = useCallback(() => {
    const data: CalibrationData = {
      centerGamma: _smoothed,
      maxAngle: MAX_STEER_ANGLE,
    }
    _calibration = data
    saveCalibration(data)
    _snapshot = { ..._snapshot, isCalibrated: true }
    emit()
  }, [])

  const stop = useCallback(() => {
    if (_listening) {
      window.removeEventListener('deviceorientation', handleOrientation)
      _listening = false
    }
  }, [])

  return {
    ...state,
    needsPermission,
    requestPermissionAndStart,
    calibrate,
    stop,
  }
}

function loadCalibration(): CalibrationData | null {
  try {
    const saved = localStorage.getItem('controller-calibration')
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

function saveCalibration(data: CalibrationData) {
  localStorage.setItem('controller-calibration', JSON.stringify(data))
}
