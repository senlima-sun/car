import RadarMinimap from './RadarMinimap'
import WeatherFrontEditor from './WeatherFrontEditor'
import SunControl from './SunControl'
import ClimateControls from './ClimateControls'
import DraggablePanel from '../DevTools/DraggablePanel'

export default function WeatherPanel() {
  return (
    <DraggablePanel id='weather' title='Weather Radar'>
      <div style={styles.content}>
        <div style={styles.column}>
          <div style={styles.subLabel}>Live radar</div>
          <RadarMinimap />
        </div>
        <div style={styles.column}>
          <WeatherFrontEditor />
        </div>
        <div style={styles.column}>
          <ClimateControls />
          <SunControl />
        </div>
      </div>
    </DraggablePanel>
  )
}

const styles = {
  content: {
    display: 'flex' as const,
    gap: 12,
    padding: 12,
    color: '#d8e3f0',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  column: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
  },
  subLabel: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#88b0ff',
  },
}
