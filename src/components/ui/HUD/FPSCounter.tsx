import { useFPSStore } from '../../../stores/useFPSStore'
import { usePerformanceStore } from '../../../stores/usePerformanceStore'
import { TARGET_FPS } from '../../../stores/useFrameRateStore'
import { PERFORMANCE, UI } from '@/constants/colors'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '10px 14px',
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 1.6,
  },
}

function getFPSColor(fps: number, target: number): string {
  const ratio = fps / target
  if (ratio >= 0.95) return PERFORMANCE.fpsGood
  if (ratio >= 0.8) return PERFORMANCE.fpsWarning
  return PERFORMANCE.fpsBad
}

export default function FPSCounter() {
  const fps = useFPSStore(state => state.fps)
  const { avgFps, avgFrameTime, onePercentLowFps } = usePerformanceStore()
  const color = getFPSColor(fps, TARGET_FPS)

  const deviation = Math.round(((fps - TARGET_FPS) / TARGET_FPS) * 100)

  return (
    <div style={styles.container}>
      <div>
        <span style={{ color, opacity: 0.95, fontSize: 16, fontWeight: 'bold' }}>{fps}</span>
        <span style={{ color: UI.textMuted, marginLeft: 5, fontSize: 12 }}>FPS</span>
        {Math.abs(deviation) > 5 && (
          <span style={{
            color: deviation > 0 ? PERFORMANCE.fpsGood : PERFORMANCE.fpsWarning,
            marginLeft: 6,
            fontSize: 11,
          }}>
            {deviation > 0 ? '+' : ''}{deviation}%
          </span>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: UI.textMuted, opacity: 0.8 }}>
        <div>Avg: {avgFps} fps ({avgFrameTime.toFixed(2)}ms)</div>
        <div>1% Low: {onePercentLowFps} fps</div>
      </div>
    </div>
  )
}
