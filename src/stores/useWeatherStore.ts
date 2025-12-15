import { create } from 'zustand'
import {
  WeatherCondition,
  WeatherModifiers,
  WEATHER_CONFIG,
  DEFAULT_WEATHER,
  WEATHER_TRANSITION_DURATION,
  WEATHER_ORDER,
} from '../constants/weather'

interface WeatherState {
  // Current weather condition
  currentWeather: WeatherCondition

  // Previous weather (for transitions)
  previousWeather: WeatherCondition

  // Transition progress (0-1, 1 = fully transitioned)
  transitionProgress: number

  // Is transitioning between weathers
  isTransitioning: boolean

  // Computed current modifiers (interpolated during transitions)
  currentModifiers: WeatherModifiers

  // Actions
  setWeather: (weather: WeatherCondition) => void
  updateTransition: (delta: number) => void
  cycleWeather: () => void
}

// Linear interpolation helper for modifiers
function lerpModifiers(from: WeatherModifiers, to: WeatherModifiers, t: number): WeatherModifiers {
  return {
    frictionSlipMultiplier:
      from.frictionSlipMultiplier + (to.frictionSlipMultiplier - from.frictionSlipMultiplier) * t,
    dragMultiplier: from.dragMultiplier + (to.dragMultiplier - from.dragMultiplier) * t,
    downforceMultiplier:
      from.downforceMultiplier + (to.downforceMultiplier - from.downforceMultiplier) * t,
    engineEfficiencyMultiplier:
      from.engineEfficiencyMultiplier +
      (to.engineEfficiencyMultiplier - from.engineEfficiencyMultiplier) * t,
    brakeEfficiencyMultiplier:
      from.brakeEfficiencyMultiplier +
      (to.brakeEfficiencyMultiplier - from.brakeEfficiencyMultiplier) * t,
    steerResponseMultiplier:
      from.steerResponseMultiplier +
      (to.steerResponseMultiplier - from.steerResponseMultiplier) * t,
    maxSteerAngleMultiplier:
      from.maxSteerAngleMultiplier +
      (to.maxSteerAngleMultiplier - from.maxSteerAngleMultiplier) * t,
    driftEntrySlipAngleMultiplier:
      from.driftEntrySlipAngleMultiplier +
      (to.driftEntrySlipAngleMultiplier - from.driftEntrySlipAngleMultiplier) * t,
    driftLateralCorrectionMultiplier:
      from.driftLateralCorrectionMultiplier +
      (to.driftLateralCorrectionMultiplier - from.driftLateralCorrectionMultiplier) * t,
    maxSpeedMultiplier:
      from.maxSpeedMultiplier + (to.maxSpeedMultiplier - from.maxSpeedMultiplier) * t,
    // Non-interpolated values - use target
    displayName: to.displayName,
    description: to.description,
    icon: to.icon,
  }
}

export const useWeatherStore = create<WeatherState>((set, get) => ({
  currentWeather: DEFAULT_WEATHER,
  previousWeather: DEFAULT_WEATHER,
  transitionProgress: 1,
  isTransitioning: false,
  currentModifiers: WEATHER_CONFIG[DEFAULT_WEATHER],

  setWeather: weather => {
    const state = get()
    if (weather === state.currentWeather) return

    set({
      previousWeather: state.currentWeather,
      currentWeather: weather,
      transitionProgress: 0,
      isTransitioning: true,
    })
  },

  updateTransition: delta => {
    const state = get()
    if (!state.isTransitioning) return

    const progressDelta = (delta * 1000) / WEATHER_TRANSITION_DURATION
    const newProgress = Math.min(1, state.transitionProgress + progressDelta)

    const fromModifiers = WEATHER_CONFIG[state.previousWeather]
    const toModifiers = WEATHER_CONFIG[state.currentWeather]

    // Smooth easing for transition (smoothstep)
    const easedProgress = newProgress * newProgress * (3 - 2 * newProgress)

    set({
      transitionProgress: newProgress,
      isTransitioning: newProgress < 1,
      currentModifiers: lerpModifiers(fromModifiers, toModifiers, easedProgress),
    })
  },

  cycleWeather: () => {
    const state = get()
    const currentIndex = WEATHER_ORDER.indexOf(state.currentWeather)
    const nextIndex = (currentIndex + 1) % WEATHER_ORDER.length
    state.setWeather(WEATHER_ORDER[nextIndex])
  },
}))
