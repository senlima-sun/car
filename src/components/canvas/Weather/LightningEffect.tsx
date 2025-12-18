import { useRef, useState, useCallback } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'

// Lightning flash pattern - multi-flash for realism
interface FlashPattern {
  flashes: { intensity: number; duration: number }[]
  totalDuration: number
}

function generateFlashPattern(): FlashPattern {
  // Random number of flashes (1-4)
  const numFlashes = 1 + Math.floor(Math.random() * 4)
  const flashes: { intensity: number; duration: number }[] = []
  let totalDuration = 0

  for (let i = 0; i < numFlashes; i++) {
    // First flash is brightest
    const intensity = i === 0 ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.4
    const duration = 0.05 + Math.random() * 0.1

    flashes.push({ intensity, duration })
    totalDuration += duration

    // Add gap between flashes (except after last)
    if (i < numFlashes - 1) {
      const gap = 0.05 + Math.random() * 0.15
      flashes.push({ intensity: 0, duration: gap })
      totalDuration += gap
    }
  }

  return { flashes, totalDuration }
}

export default function LightningEffect() {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  // Lightning timing state
  const [nextFlashTime, setNextFlashTime] = useState(5 + Math.random() * 10)
  const [isFlashing, setIsFlashing] = useState(false)
  const [currentPattern, setCurrentPattern] = useState<FlashPattern | null>(null)
  const flashStartTime = useRef(0)
  const elapsedTime = useRef(0)

  // Lightning only in heavy rain (intensity > 0.6)
  const isRaining = rainIntensity > 0.6

  // Schedule next flash
  const scheduleNextFlash = useCallback(() => {
    // Random interval: 8-23 seconds between lightning strikes
    const interval = 8 + Math.random() * 15
    setNextFlashTime(elapsedTime.current + interval)
  }, [])

  useFrame((_, delta) => {
    if (!lightRef.current || !isRaining) {
      // Reset light when not raining
      if (lightRef.current) {
        lightRef.current.intensity = 0
      }
      return
    }

    elapsedTime.current += delta

    // Check if it's time to flash
    if (!isFlashing && elapsedTime.current >= nextFlashTime) {
      setIsFlashing(true)
      setCurrentPattern(generateFlashPattern())
      flashStartTime.current = elapsedTime.current
    }

    // Process flash animation
    if (isFlashing && currentPattern) {
      const flashElapsed = elapsedTime.current - flashStartTime.current

      if (flashElapsed >= currentPattern.totalDuration) {
        // Flash complete
        setIsFlashing(false)
        setCurrentPattern(null)
        lightRef.current.intensity = 0
        scheduleNextFlash()
      } else {
        // Find current flash segment
        let accumulatedTime = 0
        let currentIntensity = 0

        for (const flash of currentPattern.flashes) {
          if (flashElapsed < accumulatedTime + flash.duration) {
            // Calculate smooth intensity within this segment
            const segmentProgress = (flashElapsed - accumulatedTime) / flash.duration

            if (flash.intensity > 0) {
              // Flash segment - quick rise, slower decay
              const risePhase = 0.2
              if (segmentProgress < risePhase) {
                currentIntensity = (segmentProgress / risePhase) * flash.intensity
              } else {
                const decayProgress = (segmentProgress - risePhase) / (1 - risePhase)
                currentIntensity = flash.intensity * (1 - decayProgress * 0.6)
              }
            } else {
              // Gap segment
              currentIntensity = 0
            }
            break
          }
          accumulatedTime += flash.duration
        }

        // Apply intensity with maximum brightness multiplier
        lightRef.current.intensity = currentIntensity * 8
      }
    }
  })

  if (!isRaining) return null

  return (
    <directionalLight
      ref={lightRef}
      color='#e0e8ff'
      intensity={0}
      position={[100, 200, 50]}
      castShadow={false}
    />
  )
}
