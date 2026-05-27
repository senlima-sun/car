import {
  getRainDescription,
  getTemperatureDescription,
  useEnvironmentStore,
} from '@/stores/useEnvironmentStore'

export default function ClimateControls() {
  const temperature = useEnvironmentStore(s => s.temperature)
  const humidity = useEnvironmentStore(s => s.humidity)
  const precipitationRate = useEnvironmentStore(s => s.precipitationRate)
  const cloudCover = useEnvironmentStore(s => s.cloudCover)
  const setTemperature = useEnvironmentStore(s => s.setTemperature)
  const setHumidity = useEnvironmentStore(s => s.setHumidity)
  const setPrecipitationRate = useEnvironmentStore(s => s.setPrecipitationRate)
  const setCloudCover = useEnvironmentStore(s => s.setCloudCover)

  const rainIntensity = Math.min(precipitationRate / 50, 1)

  return (
    <div style={styles.container}>
      <div style={styles.label}>Climate</div>
      <Row
        name='temp'
        value={`${temperature.toFixed(1)}°C · ${getTemperatureDescription(temperature)}`}
      >
        <input
          style={styles.range}
          type='range'
          min={-10}
          max={50}
          step={0.5}
          value={temperature}
          onChange={e => setTemperature(Number(e.target.value))}
        />
      </Row>
      <Row name='humidity' value={`${(humidity * 100).toFixed(0)}%`}>
        <input
          style={styles.range}
          type='range'
          min={0}
          max={1}
          step={0.01}
          value={humidity}
          onChange={e => setHumidity(Number(e.target.value))}
        />
      </Row>
      <Row name='rain' value={`${precipitationRate.toFixed(1)} mm/h · ${getRainDescription(rainIntensity)}`}>
        <input
          style={styles.range}
          type='range'
          min={0}
          max={50}
          step={0.5}
          value={precipitationRate}
          onChange={e => setPrecipitationRate(Number(e.target.value))}
        />
      </Row>
      <Row name='clouds' value={`${(cloudCover * 100).toFixed(0)}%`}>
        <input
          style={styles.range}
          type='range'
          min={0}
          max={1}
          step={0.01}
          value={cloudCover}
          onChange={e => setCloudCover(Number(e.target.value))}
        />
      </Row>
    </div>
  )
}

function Row({
  name,
  value,
  children,
}: {
  name: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div style={styles.row}>
      <span style={styles.name}>{name}</span>
      {children}
      <span style={styles.value}>{value}</span>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
    minWidth: 220,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#88b0ff',
  },
  row: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  name: { fontSize: 10, color: '#9bb0c8', minWidth: 56 },
  range: { flex: 1 },
  value: { fontSize: 10, color: '#e8f0fa', minWidth: 110, textAlign: 'right' as const },
}
