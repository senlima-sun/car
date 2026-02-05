import { useEffect, useRef, useCallback } from 'react'
import { useAudioContext } from './AudioContext'
import { EngineSound } from './engine/EngineSound'
import {
  TireSound,
  DriftSound,
  AquaplaningSound,
  WindSound,
  RainSound,
  ErsSound,
  TemperatureSound,
  TrackLimitsSound,
  AeroSound,
} from './effects'
import { UISound } from './ui/UISound'
import { GameStateAudio } from './GameStateAudio'
import { useAudioBridgeStore } from '@/stores/useAudioBridgeStore'
import { useGameStore } from '@/stores/useGameStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { usePitStore } from '@/stores/usePitStore'
import type { FrameAudioParams } from './types'

export function useAudioSystem() {
  const audioManager = useAudioContext()
  const frameCountRef = useRef(0)

  const engineSoundRef = useRef<EngineSound | null>(null)
  const tireSoundRef = useRef<TireSound | null>(null)
  const driftSoundRef = useRef<DriftSound | null>(null)
  const aquaplaningSoundRef = useRef<AquaplaningSound | null>(null)
  const windSoundRef = useRef<WindSound | null>(null)
  const rainSoundRef = useRef<RainSound | null>(null)
  const ersSoundRef = useRef<ErsSound | null>(null)
  const temperatureSoundRef = useRef<TemperatureSound | null>(null)
  const trackLimitsSoundRef = useRef<TrackLimitsSound | null>(null)
  const aeroSoundRef = useRef<AeroSound | null>(null)
  const uiSoundRef = useRef<UISound | null>(null)
  const gameStateAudioRef = useRef<GameStateAudio | null>(null)

  useEffect(() => {
    const engineSound = new EngineSound(audioManager)
    const tireSound = new TireSound(audioManager)
    const driftSound = new DriftSound(audioManager)
    const aquaplaningSound = new AquaplaningSound(audioManager)
    const windSound = new WindSound(audioManager)
    const rainSound = new RainSound(audioManager)
    const ersSound = new ErsSound(audioManager)
    const temperatureSound = new TemperatureSound(audioManager)
    const trackLimitsSound = new TrackLimitsSound(audioManager)
    const aeroSound = new AeroSound(audioManager)
    const uiSound = new UISound(audioManager)
    const gameStateAudio = new GameStateAudio(audioManager)

    engineSound.registerSounds()
    tireSound.registerSounds()
    driftSound.registerSounds()
    aquaplaningSound.registerSounds()
    windSound.registerSounds()
    rainSound.registerSounds()
    ersSound.registerSounds()
    temperatureSound.registerSounds()
    trackLimitsSound.registerSounds()
    aeroSound.registerSounds()
    uiSound.registerSounds()
    gameStateAudio.registerSounds()

    engineSound.start()
    tireSound.start()
    windSound.start()
    rainSound.start()

    engineSoundRef.current = engineSound
    tireSoundRef.current = tireSound
    driftSoundRef.current = driftSound
    aquaplaningSoundRef.current = aquaplaningSound
    windSoundRef.current = windSound
    rainSoundRef.current = rainSound
    ersSoundRef.current = ersSound
    temperatureSoundRef.current = temperatureSound
    trackLimitsSoundRef.current = trackLimitsSound
    aeroSoundRef.current = aeroSound
    uiSoundRef.current = uiSound
    gameStateAudioRef.current = gameStateAudio

    return () => {
      engineSound.stop()
      tireSound.stop()
      windSound.stop()
      rainSound.stop()
      ersSound.dispose()
      temperatureSound.dispose()
      gameStateAudio.dispose()
    }
  }, [audioManager])

  useEffect(() => {
    let previousStatus = useGameStore.getState().status
    const unsubscribe = useGameStore.subscribe(state => {
      if (state.status !== previousStatus) {
        gameStateAudioRef.current?.onStatusChange(state.status, previousStatus)
        previousStatus = state.status
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    let previousLapCount = useLapTimeStore.getState().lapCount
    let previousBestLap = useLapTimeStore.getState().bestLapTime
    const unsubscribe = useLapTimeStore.subscribe(state => {
      if (state.lapCount > previousLapCount) {
        uiSoundRef.current?.playLapComplete()
      }
      if (state.bestLapTime !== null && state.bestLapTime !== previousBestLap) {
        uiSoundRef.current?.playBestLap()
      }
      previousLapCount = state.lapCount
      previousBestLap = state.bestLapTime
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    let previousPitActive = usePitStore.getState().isPitStopActive
    const unsubscribe = usePitStore.subscribe(state => {
      if (!state.isPitStopActive && previousPitActive) {
        uiSoundRef.current?.playPitComplete()
      }
      previousPitActive = state.isPitStopActive
    })
    return unsubscribe
  }, [])

  const updateFrame = useCallback((params: FrameAudioParams) => {
    frameCountRef.current++

    engineSoundRef.current?.updateRPM(params.rpm)
    engineSoundRef.current?.updateGear(params.gear)
    tireSoundRef.current?.update(params.slipAngle, params.surface)
    driftSoundRef.current?.update(params.isDrifting, params.skidIntensity)

    if (frameCountRef.current % 4 === 0) {
      windSoundRef.current?.update(params.speed, params.windSpeed)
      rainSoundRef.current?.update(params.rainIntensity)
      aquaplaningSoundRef.current?.update(params.isAquaplaning, params.aquaplaningIntensity)
      ersSoundRef.current?.update(
        params.isDeploying,
        params.isHarvesting,
        params.powerFlow,
        params.harvestSource
      )
      engineSoundRef.current?.updateEngineBraking(params.engineBraking)
    }
  }, [])

  useEffect(() => {
    useAudioBridgeStore.getState().setUpdateFrame(updateFrame)
  }, [updateFrame])

  return { updateFrame, engineSound: engineSoundRef, uiSound: uiSoundRef }
}
