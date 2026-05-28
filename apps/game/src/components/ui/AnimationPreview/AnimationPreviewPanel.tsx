import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Car, Eye, Settings } from 'lucide-react'
import { motion } from 'motion/react'
import { useNavigate } from '@tanstack/react-router'
import { useFeatureGate } from '@/auth/useFeatureGate'
import { CAR_PARTS, PAINT_PRESETS, useCarPaintStore } from '@/stores/useCarPaintStore'
import { useGameStore } from '@/stores/useGameStore'
import { useShowroomStore } from '@/stores/useShowroomStore'
import {
  CreditsButton,
  GlobalSettingsGrid,
  HoverBadge,
  PartMenu,
  PartOption,
  Popover,
  SelectedPartBadge,
  ShowroomHud,
  ShowroomToolbar,
  ToolButton,
} from './primitives/ShowroomPanel'
import { AeroSection } from './sections/AeroSection'
import { CarPaintSection } from './sections/CarPaintSection'
import { SceneSection } from './sections/SceneSection'
import { SteeringSection } from './sections/SteeringSection'
import { WheelsSection } from './sections/WheelsSection'

type PopupMode = 'parts' | 'partEditor' | 'settings' | null

export default function AnimationPreviewPanel() {
  const partColors = useCarPaintStore(s => s.partColors)
  const selectedPart = useCarPaintStore(s => s.selectedPart)
  const hoveredPart = useShowroomStore(s => s.hoveredPart)
  const cameraView = useShowroomStore(s => s.cameraView)
  const [popupMode, setPopupMode] = useState<PopupMode>(null)
  const lastSelectedPart = useRef(selectedPart)
  const showroomFullGate = useFeatureGate('showroomFull')
  const navigate = useNavigate()

  const activePresetName = PAINT_PRESETS.find(
    p => p.colors.body && p.colors.body.toLowerCase() === partColors.body.toLowerCase(),
  )?.name
  const hoveredPartLabel = hoveredPart
    ? CAR_PARTS.find(part => part.id === hoveredPart)?.label
    : null
  const selectedPartLabel =
    selectedPart === 'all' ? 'All Parts' : CAR_PARTS.find(part => part.id === selectedPart)?.label

  useEffect(() => {
    if (selectedPart === lastSelectedPart.current) return
    lastSelectedPart.current = selectedPart
    setPopupMode('partEditor')
  }, [selectedPart])

  const closePopup = () => setPopupMode(null)
  const selectPart = (part: typeof selectedPart) => {
    useCarPaintStore.getState().setSelectedPart(part)
    setPopupMode('partEditor')
  }

  return (
    <ShowroomHud>
      {hoveredPartLabel && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <HoverBadge>{hoveredPartLabel}</HoverBadge>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <ShowroomToolbar>
          <ToolButton
            danger
            icon={ArrowLeft}
            title='Back'
            onClick={() => useGameStore.getState().exitPreviewMode()}
          />
          <ToolButton
            icon={Car}
            title='Parts'
            active={popupMode === 'parts' || popupMode === 'partEditor'}
            onClick={() => setPopupMode(mode => (mode === 'parts' ? null : 'parts'))}
          />
          <ToolButton
            icon={Settings}
            title='Showroom Settings'
            active={popupMode === 'settings'}
            onClick={() => {
              if (!showroomFullGate.allowed) {
                navigate({ to: '/account', search: { upgrade: 'showroomFull' } })
                return
              }
              setPopupMode(mode => (mode === 'settings' ? null : 'settings'))
            }}
          />
          <ToolButton
            icon={Eye}
            title={cameraView === 'cockpit' ? 'Orbit View' : 'Driver POV'}
            active={cameraView === 'cockpit'}
            onClick={() =>
              useShowroomStore
                .getState()
                .setCameraView(cameraView === 'cockpit' ? 'orbit' : 'cockpit')
            }
          />
          <CreditsButton />
        </ShowroomToolbar>
      </motion.div>

      {popupMode === 'parts' && (
        <Popover
          title='Parts'
          meta={`${selectedPartLabel}${activePresetName ? ` · ${activePresetName}` : ''}`}
          onClose={closePopup}
        >
          <PartMenu>
            <PartOption
              label='All Parts'
              active={selectedPart === 'all'}
              onClick={() => selectPart('all')}
            />
            {CAR_PARTS.map(part => (
              <PartOption
                key={part.id}
                label={part.label}
                color={partColors[part.id]}
                active={selectedPart === part.id}
                highlighted={hoveredPart === part.id}
                onClick={() => selectPart(part.id)}
              />
            ))}
          </PartMenu>
        </Popover>
      )}

      {popupMode === 'partEditor' && (
        <Popover title='Paint' meta={activePresetName} onClose={closePopup}>
          <SelectedPartBadge>{selectedPartLabel}</SelectedPartBadge>
          <CarPaintSection />
        </Popover>
      )}

      {popupMode === 'settings' && (
        <Popover title='Showroom Settings' onClose={closePopup}>
          <GlobalSettingsGrid>
            <AeroSection />
            <SteeringSection />
            <WheelsSection />
            <SceneSection />
          </GlobalSettingsGrid>
        </Popover>
      )}
    </ShowroomHud>
  )
}
