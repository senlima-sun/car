import { useEffect, useState, useRef } from 'react'
import RacePanel from './RacePanel'
import PitStopUI from './PitStopUI'
import WeatherControlModal from './WeatherControlModal'
import AquaplaningIndicator from './AquaplaningIndicator'
import TrackLimitsIndicator from './TrackLimitsIndicator'
import WrongWayIndicator from './WrongWayIndicator'
import PitLaneSpeedIndicator from './PitLaneSpeedIndicator'
import LapTimer from './LapTimer'
import CoastIndicator from './CoastIndicator'
import PhysicsDebugOverlay from '../PhysicsDebugOverlay'
import { SettingsDialog } from '../SettingsDialog'
import { useGameStore } from '@/stores/useGameStore'
import { usePitStore } from '@/stores/usePitStore'
import { TrackEditorDock } from '../TrackEditorDock'
import { TrackSelector } from '../TrackSelector'
import { MobileControls, MobileSpeedGear } from '../MobileControls'
import TrackMinimap from '../CustomizationPanel/TrackMinimap'
import ElevationProfile from '../ElevationProfile/ElevationProfile'
import { AnimationPreviewPanel } from '../AnimationPreview'
import { SVGEditor } from '../SVGEditor'
import { MainMenu } from '../MainMenu'
import { useMobileDetection } from '@/utils/isMobile'
import { TelemetryOverlay } from '../TelemetryOverlay'
import { TelemetryAnalysis } from '../TelemetryAnalysis'
import FPSCounter from './FPSCounter'

export default function HUD() {
  const isMobile = useMobileDetection()
  const status = useGameStore(s => s.status)
  const cameraMode = useGameStore(s => s.cameraMode)
  const isTestingMode = useGameStore(s => s.isTestingMode)
  const isInPitBox = usePitStore(s => s.isInPitBox)
  const isMenuMode = status === 'menu'
  const isCustomizeMode = status === 'customize'
  const isPreviewMode = status === 'preview'

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
      <FPSCounter />
      {!isMenuMode && !isCustomizeMode && !isPreviewMode && <TrackMinimap />}

      {modeNotification && (
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white px-8 py-4 rounded-lg font-bold text-lg pointer-events-none z-[999] animate-[fadeInOut_2s_ease] ${
            isTestingMode ? 'bg-red-500/90' : 'bg-green-400/90'
          }`}
        >
          {modeNotification}
        </div>
      )}

      <WeatherControlModal />
      <SettingsDialog />

      {isMenuMode ? (
        <MainMenu />
      ) : isPreviewMode ? (
        <AnimationPreviewPanel />
      ) : isCustomizeMode ? (
        <>
          <SVGEditor />
          <div className='absolute top-5 left-1/2 -translate-x-1/2 pointer-events-auto z-20'>
            <TrackSelector />
          </div>
          <div className='z-20'>
            <TrackEditorDock />
          </div>
          <div className='z-20'>
            <ElevationProfile />
          </div>
        </>
      ) : (
        <>
          {cameraMode !== 'first-person' && <LapTimer />}

          {isMobile && <MobileSpeedGear />}

          {!isMobile && cameraMode !== 'first-person' && (
            <>
              <div className='absolute bottom-[100px] left-1/2 -translate-x-1/2'>
                <CoastIndicator />
              </div>
              <div className='absolute bottom-5 left-1/2 -translate-x-1/2'>
                <RacePanel />
              </div>
            </>
          )}

          {isInPitBox && (
            <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500/90 text-white px-6 py-3 rounded-lg font-bold text-base pointer-events-none'>
              {isMobile ? 'Tap P for tires' : 'Press P to open tire selection'}
            </div>
          )}

          <PitStopUI />

          {isMobile && <MobileControls />}

          <AquaplaningIndicator />
          <TrackLimitsIndicator />
          <WrongWayIndicator />
          <PitLaneSpeedIndicator />
          {isTestingMode && <PhysicsDebugOverlay />}
          <TelemetryOverlay />
          <TelemetryAnalysis />
        </>
      )}
    </div>
  )
}
