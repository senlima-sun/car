import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/stores/useGameStore'
import {
  accumulateWheelAngle,
  applyDecay,
  applyGammaCurve,
  applyVariableRatio,
  wheelAngleToSteer,
} from '@/input/steeringMath'
import SteeringWheelIndicator from '@/components/ui/HUD/SteeringWheelIndicator'

export function MouseSteeringPreview() {
  const config = useGameStore(s => s.mouseSteeringConfig)
  const configRef = useRef(config)
  configRef.current = config

  const [hovering, setHovering] = useState(false)
  const wheelAngleRef = useRef(0)
  const pendingDeltaRef = useRef(0)
  const lastSteerRef = useRef(0)
  const holdRef = useRef(false)
  const areaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      pendingDeltaRef.current += e.movementX
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) holdRef.current = true
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) holdRef.current = false
    }
    const area = areaRef.current
    if (!area || !hovering) return
    area.addEventListener('mousemove', onMouseMove)
    area.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      area.removeEventListener('mousemove', onMouseMove)
      area.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      holdRef.current = false
    }
  }, [hovering])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const cfg = configRef.current
      const maxRad = (cfg.maxWheelAngleDeg * Math.PI) / 180
      if (pendingDeltaRef.current !== 0) {
        wheelAngleRef.current = accumulateWheelAngle(
          wheelAngleRef.current,
          pendingDeltaRef.current,
          cfg.sensitivityRadPerPx,
          maxRad,
        )
        pendingDeltaRef.current = 0
      } else if (!holdRef.current) {
        wheelAngleRef.current = applyDecay(wheelAngleRef.current, dt, cfg.decayRatePerSec)
      }
      const normalised = wheelAngleToSteer(wheelAngleRef.current, maxRad)
      const curved = applyGammaCurve(normalised, cfg.gamma)
      lastSteerRef.current = applyVariableRatio(curved, 0, cfg.ratioAtRest, cfg.ratioAtTopSpeed)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className='border-l-2 border-white/8 pl-4 ml-2 mb-4'>
      <div className='text-white/85 text-[12px] font-medium mb-1'>Live Preview</div>
      <div className='text-white/35 text-[10px] mb-3'>
        Move the mouse over the area below to test. Hold left-click to lock the wheel.
      </div>
      <div className='flex items-center gap-4'>
        <div
          ref={areaRef}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`flex-1 h-[88px] rounded border ${
            hovering ? 'border-white/30 bg-white/5' : 'border-white/10 bg-white/2'
          } flex items-center justify-center text-[10px] text-white/40 transition-colors cursor-crosshair`}
        >
          {hovering ? 'move ← → · hold click to lock' : 'hover here to test'}
        </div>
        <div className='shrink-0'>
          <SteeringWheelIndicator source={() => wheelAngleRef.current} size={64} barWidth={120} />
        </div>
      </div>
    </div>
  )
}
