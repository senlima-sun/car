import { motion } from 'motion/react'
import { CAR_PARTS, PAINT_PRESETS, useCarPaintStore } from '@/stores/useCarPaintStore'
import { useGameStore } from '@/stores/useGameStore'
import { useShowroomStore } from '@/stores/useShowroomStore'
import { sectionVariants } from './constants/animations'
import {
  HoverBadge,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelScrollArea,
  PanelSectionGrid,
  PanelShell,
  PartOption,
  PartRail,
} from './primitives/ShowroomPanel'
import { AeroSection } from './sections/AeroSection'
import { CarPaintSection } from './sections/CarPaintSection'
import { SceneSection } from './sections/SceneSection'
import { SteeringSection } from './sections/SteeringSection'
import { WheelsSection } from './sections/WheelsSection'

export default function AnimationPreviewPanel() {
  const partColors = useCarPaintStore(s => s.partColors)
  const selectedPart = useCarPaintStore(s => s.selectedPart)
  const hoveredPart = useShowroomStore(s => s.hoveredPart)
  const activePresetName = PAINT_PRESETS.find(
    p => p.colors.body && p.colors.body.toLowerCase() === partColors.body.toLowerCase(),
  )?.name
  const hoveredPartLabel = hoveredPart
    ? CAR_PARTS.find(part => part.id === hoveredPart)?.label
    : null
  const selectedPartLabel =
    selectedPart === 'all' ? 'All Parts' : CAR_PARTS.find(part => part.id === selectedPart)?.label

  return (
    <>
      {hoveredPartLabel && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <HoverBadge>{hoveredPartLabel}</HoverBadge>
        </motion.div>
      )}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <PanelShell>
          <PanelHeader
            title='Showroom'
            meta={`${selectedPartLabel}${activePresetName ? ` · ${activePresetName}` : ''}`}
          />

          <motion.div
            variants={sectionVariants}
            initial='hidden'
            animate='visible'
            className='min-h-0 flex-1'
          >
            <PanelBody>
              <PartRail>
                <PartOption
                  label='All Parts'
                  active={selectedPart === 'all'}
                  onClick={() => useCarPaintStore.getState().setSelectedPart('all')}
                />
                {CAR_PARTS.map(part => (
                  <PartOption
                    key={part.id}
                    label={part.label}
                    color={partColors[part.id]}
                    active={selectedPart === part.id}
                    highlighted={hoveredPart === part.id}
                    onClick={() => useCarPaintStore.getState().setSelectedPart(part.id)}
                  />
                ))}
              </PartRail>

              <PanelScrollArea>
                <CarPaintSection />
                <PanelSectionGrid>
                  <AeroSection />
                  <SteeringSection />
                  <WheelsSection />
                  <SceneSection />
                </PanelSectionGrid>
              </PanelScrollArea>
            </PanelBody>
          </motion.div>

          <PanelFooter onBack={() => useGameStore.getState().exitPreviewMode()} />
        </PanelShell>
      </motion.div>
    </>
  )
}
