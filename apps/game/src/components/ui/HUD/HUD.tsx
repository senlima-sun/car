import { useEffect, useState, useRef } from 'react'
import RacePanel from './RacePanel'
import CarStatusPanel from './CarStatusPanel'
import PitStopUI from './PitStopUI'
import WeatherControlModal from './WeatherControlModal'
import TrackLimitsIndicator from './TrackLimitsIndicator'
import WrongWayIndicator from './WrongWayIndicator'
import PitLaneSpeedIndicator from './PitLaneSpeedIndicator'
import LapTimer from './LapTimer'
import CoastIndicator from './CoastIndicator'
import { BrakeStatusIndicator } from './BrakeStatusIndicator'
import { TrackLimitSnapshots } from './TrackLimitSnapshots'
import RaceIntro from './RaceIntro'
import DeltaDisplay from './DeltaDisplay'
import RaceInfoBar from './RaceInfoBar'
import Callouts from './Callouts'
import TimingTower from './TimingTower'
import PhysicsDebugOverlay from '../PhysicsDebugOverlay'
import SteeringDebugOverlay from '../SteeringDebugOverlay'
import WeatherPanel from '../WeatherPanel/WeatherPanel'
import WheelVisualEditor from '../WheelVisualEditor'
import { SettingsDialog } from '../SettingsDialog'
import { AccentBar, Surface } from '../primitives'
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
import { useDevToolsStore } from '@/stores/useDevToolsStore'
import { MobileControls, MobileSpeedGear } from '../MobileControls'
import TrackMinimap from '../CustomizationPanel/TrackMinimap'
import { AnimationPreviewPanel } from '../AnimationPreview'
import { MainMenu } from '../MainMenu'
import { TrackEditor } from '../TrackEditor'
import { TrackSwitcher } from '../TrackSwitcher'
import {
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
import DevToolbar from '../DevTools/DevToolbar'
import DevToolsSessionLifecycle from '../DevTools/DevToolsSessionLifecycle'
import { useDevToolsHotkeys } from '@/hooks/useDevToolsHotkeys'

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

  useDevToolsHotkeys(isSessionShell && isRunningSession && isTestingMode)

  const isMinimapOpen = useDevToolsStore(s => s.panels.minimap.isOpen)
  const isCarStatusOpen = useDevToolsStore(s => s.panels['car-status'].isOpen)
  const showMinimap = !isTestingMode || isMinimapOpen
  const showCarStatus = !isTestingMode || isCarStatusOpen

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
      {isRunningSession && showMinimap && <TrackMinimap />}

      {modeNotification && (
        <div
          className='absolute top-1/2 left-1/2 pointer-events-none z-[999]'
          style={{ animation: 'hud-fade-in-out 2s ease forwards' }}
        >
          <Surface variant='cardStrong' className='relative px-8 py-3'>
            <AccentBar color={isTestingMode ? '#ef4444' : '#22c55e'} />
            <span
              className='font-sans text-[14px] font-bold uppercase tracking-[0.32em] pl-1'
              style={{ color: isTestingMode ? '#ffb4b4' : '#9ef0a9' }}
            >
              {modeNotification}
            </span>
          </Surface>
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
              <div className='absolute bottom-[110px] left-1/2 -translate-x-1/2'>
                <CoastIndicator />
              </div>
              <div
                className={
                  isTestingMode ? 'absolute bottom-5 right-5' : 'absolute bottom-5 left-1/2 -translate-x-1/2'
                }
              >
                <RacePanel />
              </div>
              {showCarStatus && (
                <div className='absolute bottom-5 left-5'>
                  <CarStatusPanel />
                </div>
              )}
              <div className='absolute top-5 right-5'>
                <BrakeStatusIndicator />
              </div>
              <div className='absolute bottom-5 right-5'>
                <TrackLimitSnapshots />
              </div>
            </>
          )}

          {isRunningSession && !isMobile && mouseSteeringEnabled && (
            <div className='absolute bottom-[190px] left-1/2 -translate-x-1/2'>
              <SteeringWheelIndicator />
            </div>
          )}

          {isRunningSession && isInPitBox && (
            <div
              className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none'
              style={{ animation: 'hud-pulse 1.4s ease-in-out infinite' }}
            >
              <Surface variant='cardStrong' className='relative px-6 py-2.5'>
                <AccentBar color='#ffcc00' />
                <span className='font-sans text-[12px] font-bold uppercase tracking-[0.32em] text-[#ffcc00] pl-1'>
                  {isMobile ? 'Tap P — Tire Service' : 'Press P — Tire Service'}
                </span>
              </Surface>
            </div>
          )}

          {isRunningSession && <PitStopUI />}

          {isRunningSession && isMobile && <MobileControls />}

          {isRunningSession && <TrackLimitsIndicator />}
          {isRunningSession && <WrongWayIndicator />}
          {isRunningSession && <PitLaneSpeedIndicator />}
          {isRunningSession && isTestingMode && (
            <>
              <DevToolsSessionLifecycle />
              {!isMobile && <DevToolbar />}
              <PhysicsDebugOverlay />
              <SteeringDebugOverlay />
              <WeatherPanel />
              <TrackSwitcher />
              <WheelVisualEditor />
            </>
          )}
          {isRunningSession && <TelemetryOverlay />}
          {isRunningSession && <TelemetryAnalysis />}
        </>
      ) : null}
    </div>
  )
}
