import { useCallback, useEffect, useRef, useState } from 'react'
import { useCarStore } from '@/stores/useCarStore'
import { Chip } from '../primitives/Chip'
import { Section } from '../primitives/Section'
import { Slider } from '../primitives/Slider'

const TWO_PI = Math.PI * 2

export function WheelsSection() {
  const wheelRotations = useCarStore(s => s.wheelRotations)
  const [autoSpin, setAutoSpin] = useState(false)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const setWheelRot = (v: number) => {
    useCarStore.getState().updateTelemetry({ wheelRotations: [v, v, v, v] })
  }

  const spinLoop = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time
    const dt = (time - lastTimeRef.current) / 1000
    lastTimeRef.current = time

    const { wheelRotations: cur } = useCarStore.getState()
    const inc = dt * 8
    useCarStore.getState().updateTelemetry({
      wheelRotations: [
        (cur[0] + inc) % TWO_PI,
        (cur[1] + inc) % TWO_PI,
        (cur[2] + inc) % TWO_PI,
        (cur[3] + inc) % TWO_PI,
      ],
    })
    rafRef.current = requestAnimationFrame(spinLoop)
  }, [])

  useEffect(() => {
    if (autoSpin) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(spinLoop)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [autoSpin, spinLoop])

  return (
    <Section title='Wheels'>
      <Slider
        label='Spin'
        value={wheelRotations[0]}
        min={0}
        max={TWO_PI}
        step={0.01}
        onChange={setWheelRot}
      />
      <div className='pt-1'>
        <Chip
          label={autoSpin ? 'Stop' : 'Auto spin'}
          onClick={() => setAutoSpin(s => !s)}
          active={autoSpin}
        />
      </div>
    </Section>
  )
}
