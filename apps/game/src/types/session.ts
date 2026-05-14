export type SessionKind = 'practice' | 'qualifying' | 'race' | 'time-trial'

export type SessionPhase = 'idle' | 'setup' | 'countdown' | 'running' | 'paused' | 'finished'

export type SessionWeatherPreset = 'current' | 'dry' | 'wet' | 'random'

export interface SessionConfig {
  kind: SessionKind
  trackId: string | null
  weatherPreset: SessionWeatherPreset
  lapLimit: number | null
  timeLimitMinutes: number | null
  gridSize: number
  testingMode: boolean
}

export interface SessionResultsSnapshot {
  kind: SessionKind
  trackId: string | null
  completedAt: number
  lapCount: number
  bestLapTime: number | null
  lastLapTime: number | null
  testingMode: boolean
  invalidLapCount: number
  pitLanePenaltySeconds: number
  trackLimitsViolations: number
  sectorEvents: number
  eventCount: number
}

export function createSessionConfig(
  kind: SessionKind,
  overrides: Partial<Omit<SessionConfig, 'kind'>> = {},
): SessionConfig {
  const baseConfig: SessionConfig = {
    kind,
    trackId: 'silverstone',
    weatherPreset: 'current',
    lapLimit: kind === 'race' ? 5 : kind === 'qualifying' ? 3 : null,
    timeLimitMinutes: kind === 'practice' ? 30 : null,
    gridSize: kind === 'race' ? 10 : 1,
    testingMode: false,
  }

  return {
    ...baseConfig,
    ...overrides,
  }
}

export const DEFAULT_SESSION_CONFIG = createSessionConfig('practice')
