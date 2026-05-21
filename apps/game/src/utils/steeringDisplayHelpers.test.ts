import { describe, expect, test } from 'vitest'
import {
  formatLapTime,
  getBatteryColor,
  getModeAbbreviation,
  getAeroAbbreviation,
  getModeColor,
  getAeroColor,
  getGearDisplay,
  getGearColor,
  getFPSColor,
  getEngineTempColor,
  getTireWearColor,
  getEngineBrakingAbbrev,
  getEngineBrakingColor,
} from './steeringDisplayHelpers'

describe('formatLapTime', () => {
  test('returns placeholder for zero time', () => {
    expect(formatLapTime(0)).toBe('-:--.---')
  })

  test('formats time correctly for 1 minute 23.456 seconds', () => {
    expect(formatLapTime(83456)).toBe('1:23.456')
  })

  test('formats time with leading zeros for seconds', () => {
    expect(formatLapTime(62500)).toBe('1:02.500')
  })

  test('formats time with leading zeros for milliseconds', () => {
    expect(formatLapTime(60005)).toBe('1:00.005')
  })

  test('formats sub-minute time correctly', () => {
    expect(formatLapTime(45123)).toBe('0:45.123')
  })
})

describe('getBatteryColor', () => {
  test('returns green for charge above 50%', () => {
    expect(getBatteryColor(75)).toBe('#22c55e')
    expect(getBatteryColor(51)).toBe('#22c55e')
  })

  test('returns amber for charge between 21-50%', () => {
    expect(getBatteryColor(50)).toBe('#f59e0b')
    expect(getBatteryColor(21)).toBe('#f59e0b')
  })

  test('returns red for charge 20% or below', () => {
    expect(getBatteryColor(20)).toBe('#ef4444')
    expect(getBatteryColor(0)).toBe('#ef4444')
  })
})

describe('getModeAbbreviation', () => {
  test('returns ATK for Attack mode', () => {
    expect(getModeAbbreviation('Attack')).toBe('ATK')
  })

  test('returns BAL for Balanced mode', () => {
    expect(getModeAbbreviation('Balanced')).toBe('BAL')
  })

  test('returns HRV for Harvest mode', () => {
    expect(getModeAbbreviation('Harvest')).toBe('HRV')
  })

  test('returns OVT for Overtake mode', () => {
    expect(getModeAbbreviation('Overtake')).toBe('OVT')
  })

  test('returns AUTO for SemiAuto mode', () => {
    expect(getModeAbbreviation('SemiAuto')).toBe('AUTO')
  })

  test('returns BAL for unknown mode', () => {
    expect(getModeAbbreviation('Unknown')).toBe('BAL')
  })
})

describe('getAeroAbbreviation', () => {
  test('returns CRN for Corner mode', () => {
    expect(getAeroAbbreviation('Corner')).toBe('CRN')
  })

  test('returns STR for Straight mode', () => {
    expect(getAeroAbbreviation('Straight')).toBe('STR')
  })

  test('returns STR for any non-Corner mode', () => {
    expect(getAeroAbbreviation('Unknown')).toBe('STR')
  })
})

describe('getModeColor', () => {
  test('returns green for Attack mode', () => {
    expect(getModeColor('Attack')).toBe('#22c55e')
  })

  test('returns white for Balanced mode', () => {
    expect(getModeColor('Balanced')).toBe('#ffffff')
  })

  test('returns blue for Harvest mode', () => {
    expect(getModeColor('Harvest')).toBe('#3b82f6')
  })

  test('returns orange for Overtake mode', () => {
    expect(getModeColor('Overtake')).toBe('#f97316')
  })

  test('returns purple for SemiAuto mode', () => {
    expect(getModeColor('SemiAuto')).toBe('#b388ff')
  })

  test('returns white for unknown mode', () => {
    expect(getModeColor('Unknown')).toBe('#ffffff')
  })
})

describe('getAeroColor', () => {
  test('returns blue for Corner mode', () => {
    expect(getAeroColor('Corner')).toBe('#3b82f6')
  })

  test('returns green for Straight mode', () => {
    expect(getAeroColor('Straight')).toBe('#22c55e')
  })
})

describe('getGearDisplay', () => {
  test('returns R for reverse gear', () => {
    expect(getGearDisplay(-1)).toBe('R')
  })

  test('returns N for neutral gear', () => {
    expect(getGearDisplay(0)).toBe('N')
  })

  test('returns number string for forward gears', () => {
    expect(getGearDisplay(1)).toBe('1')
    expect(getGearDisplay(5)).toBe('5')
    expect(getGearDisplay(8)).toBe('8')
  })
})

describe('getGearColor', () => {
  const maxRpm = 12500

  test('returns red when RPM exceeds 95% of max', () => {
    expect(getGearColor(5, 12000, maxRpm)).toBe('#ff0000')
    expect(getGearColor(5, 12500, maxRpm)).toBe('#ff0000')
  })

  test('returns red for reverse gear (below RPM threshold)', () => {
    expect(getGearColor(-1, 3000, maxRpm)).toBe('#ef4444')
  })

  test('returns amber for neutral gear', () => {
    expect(getGearColor(0, 3000, maxRpm)).toBe('#f59e0b')
  })

  test('returns white for normal forward gears', () => {
    expect(getGearColor(3, 8000, maxRpm)).toBe('#ffffff')
    expect(getGearColor(5, 10000, maxRpm)).toBe('#ffffff')
  })
})

describe('getFPSColor', () => {
  test('returns green for 50+ FPS', () => {
    expect(getFPSColor(60)).toBe('#4ade80')
    expect(getFPSColor(50)).toBe('#4ade80')
  })

  test('returns yellow for 30-49 FPS', () => {
    expect(getFPSColor(45)).toBe('#facc15')
    expect(getFPSColor(30)).toBe('#facc15')
  })

  test('returns red for below 30 FPS', () => {
    expect(getFPSColor(29)).toBe('#f87171')
    expect(getFPSColor(10)).toBe('#f87171')
  })
})

describe('getEngineTempColor', () => {
  test('returns red for critical temperature (90%+)', () => {
    expect(getEngineTempColor(0.95)).toBe('#ef4444')
    expect(getEngineTempColor(0.9)).toBe('#ef4444')
  })

  test('returns orange for high temperature (70-89%)', () => {
    expect(getEngineTempColor(0.85)).toBe('#f59e0b')
    expect(getEngineTempColor(0.7)).toBe('#f59e0b')
  })

  test('returns green for normal temperature (below 70%)', () => {
    expect(getEngineTempColor(0.5)).toBe('#22c55e')
    expect(getEngineTempColor(0.1)).toBe('#22c55e')
  })
})

describe('getTireWearColor', () => {
  test('returns red for critical wear (90%+)', () => {
    expect(getTireWearColor(95)).toBe('#ef4444')
    expect(getTireWearColor(90)).toBe('#ef4444')
  })

  test('returns amber for warning wear (70-89%)', () => {
    expect(getTireWearColor(80)).toBe('#f59e0b')
    expect(getTireWearColor(70)).toBe('#f59e0b')
  })

  test('returns green for normal wear (below 70%)', () => {
    expect(getTireWearColor(50)).toBe('#22c55e')
    expect(getTireWearColor(0)).toBe('#22c55e')
  })
})

describe('getEngineBrakingAbbrev', () => {
  test('returns L for Low', () => {
    expect(getEngineBrakingAbbrev('Low')).toBe('L')
  })

  test('returns M for Medium', () => {
    expect(getEngineBrakingAbbrev('Medium')).toBe('M')
  })

  test('returns H for High', () => {
    expect(getEngineBrakingAbbrev('High')).toBe('H')
  })

  test('returns M for unknown level', () => {
    expect(getEngineBrakingAbbrev('Unknown')).toBe('M')
  })
})

describe('getEngineBrakingColor', () => {
  test('returns blue for Low', () => {
    expect(getEngineBrakingColor('Low')).toBe('#3b82f6')
  })

  test('returns green for Medium', () => {
    expect(getEngineBrakingColor('Medium')).toBe('#22c55e')
  })

  test('returns orange for High', () => {
    expect(getEngineBrakingColor('High')).toBe('#f97316')
  })

  test('returns green for unknown level', () => {
    expect(getEngineBrakingColor('Unknown')).toBe('#22c55e')
  })
})
