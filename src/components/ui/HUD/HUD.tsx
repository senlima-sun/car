import { useEffect, useState, useRef } from 'react'
import RacePanel from './RacePanel'
import TireIndicator from './TireIndicator'
import TemperaturePanel from './TemperaturePanel'
import PitStopUI from './PitStopUI'
import WeatherControlModal from './WeatherControlModal'
import TrackLimitsIndicator from './TrackLimitsIndicator'
import WrongWayIndicator from './WrongWayIndicator'
import PitLaneSpeedIndicator from './PitLaneSpeedIndicator'
import LapTimer from './LapTimer'
import CoastIndicator from './CoastIndicator'
import RaceIntro from './RaceIntro'
import DeltaDisplay from './DeltaDisplay'
import RaceInfoBar from './RaceInfoBar'
import Callouts from './Callouts'
import TimingTower from './TimingTower'
import PhysicsDebugOverlay from '../PhysicsDebugOverlay'
import SkyStateDebug from '../Debug/SkyStateDebug'
import { SettingsDialog } from '../SettingsDialog'
import {
  isCustomizeStatus,
  isMenuStatus,
  isPreviewStatus,
  isSessionShellStatus,
  useGameStore,
} from '@/stores/useGameStore'
import {
  isRunningSessionPhase,
  isSetupSessionPhase,
  useSessionStore,
} from '@/stores/useSessionStore'
import { usePitStore } from '@/stores/usePitStore'
import { MobileControls, MobileSpeedGear } from '../MobileControls'
import TrackMinimap from '../CustomizationPanel/TrackMinimap'
import { AnimationPreviewPanel } from '../AnimationPreview'
import { MainMenu } from '../MainMenu'
import { TrackEditor } from '../TrackEditor'
import { TrackSwitcher } from '../TrackSwitcher'
import {
  CountdownOverlay,
  PauseOverlay,
  ResultsScreen,
  SessionEventBridge,
  SessionRuntimeController,
  SessionSetup,
} from '../SessionShell'
import { useMobileDetection } from '@/utils/isMobile'
import { TelemetryOverlay } from '../TelemetryOverlay'
import { TelemetryAnalysis } from '../TelemetryAnalysis'
import FPSCounter from './FPSCounter'
import SteeringWheelIndicator from './SteeringWheelIndicator'

export default function HUD() {
  const isMobile = useMobileDetection()
  const shellStatus = useGameStore(s => s.status)
  const cameraMode = useGameStore(s => s.cameraMode)
  const isTestingMode = useSessionStore(s => s.config?.testingMode ?? false)
  const sessionPhase = useSessionStore(s => s.phase)
  const isInPitBox = usePitStore(s => s.isInPitBox)
  const mouseSteeringEnabled = useGameStore(s => s.mouseSteeringEnabled)
  const isMenuMode = isMenuStatus(shellStatus)
  const isCustomizeMode = isCustomizeStatus(shellStatus)
  const isPreviewMode = isPreviewStatus(shellStatus)
  const isSessionShell = isSessionShellStatus(shellStatus)
  const isRunningSession = isSessionShell && isRunningSessionPhase(sessionPhase)

  const [modeNotification, setModeNotification] = useState<string | null>(null)
  const prevTestingMode = useRef(isTestingMode)

  useEffect(() => {
    if (isMenuMode) {
      setModeNotification(null)
      prevTestingMode.current = isTestingMode
      return
    }

    if (prevTestingMode.current !== isTestingMode) {
      setModeNotification(isTestingMode ? 'Testing Mode Enabled' : 'Racing Mode Enabled')
      const timer = setTimeout(() => setModeNotification(null), 2000)
      prevTestingMode.current = isTestingMode
      return () => clearTimeout(timer)
    }
  }, [isMenuMode, isTestingMode])

  return (
    <div className='absolute inset-0 pointer-events-none font-sans'>
      {!isCustomizeMode && !isMenuMode && !isPreviewMode && <FPSCounter />}
      {isSessionShell && <SessionRuntimeController />}
      {isSessionShell && <SessionEventBridge />}
      {isRunningSession && <TrackMinimap />}

      {modeNotification && (
        <div
          className='absolute top-1/2 left-1/2 pointer-events-none z-[999]'
          style={{ animation: 'hud-fade-in-out 2s ease forwards' }}
        >
          <div
            className='border px-8 py-3 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.5)]'
            style={{
              borderColor: isTestingMode ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)',
              background: isTestingMode
                ? 'linear-gradient(to bottom, rgba(60,10,10,0.82), rgba(10,10,10,0.9))'
                : 'linear-gradient(to bottom, rgba(10,50,20,0.82), rgba(10,10,10,0.9))',
              clipPath:
                'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%, 0 12px)',
            }}
          >
            <span
              className='font-sans text-[14px] font-bold uppercase tracking-[0.32em]'
              style={{ color: isTestingMode ? '#ffb4b4' : '#9ef0a9' }}
            >
              {modeNotification}
            </span>
          </div>
        </div>
      )}

      <WeatherControlModal />
      <SettingsDialog />

      {isMenuMode ? (
        <MainMenu />
      ) : isPreviewMode ? (
        <AnimationPreviewPanel />
      ) : isCustomizeMode ? (
        <TrackEditor />
      ) : isSessionShell ? (
        <>
          {isSetupSessionPhase(sessionPhase) && <SessionSetup />}
          <CountdownOverlay />
          <PauseOverlay />
          <ResultsScreen />

          {isRunningSession && <RaceIntro />}
          {isRunningSession && cameraMode !== 'first-person' && <RaceInfoBar />}
          {isRunningSession && cameraMode !== 'first-person' && <DeltaDisplay />}
          {isRunningSession && <Callouts />}
          {isRunningSession && cameraMode !== 'first-person' && <TimingTower />}

          {isRunningSession && cameraMode !== 'first-person' && <LapTimer />}

          {isRunningSession && isMobile && <MobileSpeedGear />}

          {isRunningSession && !isMobile && cameraMode !== 'first-person' && (
            <>
              <div className='absolute bottom-[118px] left-1/2 -translate-x-1/2'>
                <CoastIndicator />
              </div>
              <div className='absolute bottom-5 left-1/2 -translate-x-1/2'>
                <RacePanel />
              </div>
              <div className='absolute bottom-5 left-5'>
                <TireIndicator />
              </div>
              <div className='absolute bottom-5 right-5'>
                <TemperaturePanel />
              </div>
            </>
          )}

          {isRunningSession && !isMobile && mouseSteeringEnabled && (
            <div className='absolute bottom-[200px] left-1/2 -translate-x-1/2'>
              <SteeringWheelIndicator />
            </div>
          )}

          {isRunningSession && isInPitBox && (
            <div
              className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none'
              style={{ animation: 'hud-pulse 1.4s ease-in-out infinite' }}
            >
              <div
                className='border border-[#ffcc00]/60 bg-black/75 px-6 py-2.5 backdrop-blur-md shadow-[0_14px_40px_rgba(0,0,0,0.5)]'
                style={{
                  clipPath:
                    'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
                }}
              >
                <span className='font-sans text-[12px] font-bold uppercase tracking-[0.32em] text-[#ffcc00]'>
                  {isMobile ? 'Tap P — Tire Service' : 'Press P — Tire Service'}
                </span>
              </div>
            </div>
          )}

          {isRunningSession && <PitStopUI />}

          {isRunningSession && isMobile && <MobileControls />}

          {isRunningSession && <TrackLimitsIndicator />}
          {isRunningSession && <WrongWayIndicator />}
          {isRunningSession && <PitLaneSpeedIndicator />}
          {isRunningSession && isTestingMode && <PhysicsDebugOverlay />}
          {isRunningSession && isTestingMode && <SkyStateDebug />}
          {isRunningSession && isTestingMode && <TrackSwitcher />}
          {isRunningSession && <TelemetryOverlay />}
          {isRunningSession && <TelemetryAnalysis />}
        </>
      ) : null}
    </div>
  )
}
