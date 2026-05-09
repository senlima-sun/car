import { useEffect, useRef } from 'react'
import { getWheelAngleRad, peekSteer } from '@/input/mouseSteeringState'

const WHEEL_PX = 56
const BAR_WIDTH = 110
const BAR_HALF = BAR_WIDTH / 2

export default function SteeringWheelIndicator() {
  const wheelRef = useRef<SVGGElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const wheelRad = getWheelAngleRad()
      const steer = peekSteer()
      if (wheelRef.current) {
        const deg = (wheelRad * 180) / Math.PI
        wheelRef.current.setAttribute('transform', `rotate(${deg.toFixed(2)})`)
      }
      if (fillRef.current) {
        const clamped = Math.max(-1, Math.min(1, steer))
        const width = Math.abs(clamped) * BAR_HALF
        const left = clamped >= 0 ? BAR_HALF : BAR_HALF - width
        fillRef.current.style.width = `${width.toFixed(1)}px`
        fillRef.current.style.left = `${left.toFixed(1)}px`
        fillRef.current.style.background =
          Math.abs(clamped) > 0.7 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(34, 197, 94, 0.85)'
      }
      if (labelRef.current) {
        const deg = (wheelRad * 180) / Math.PI
        labelRef.current.textContent = `${deg >= 0 ? '+' : ''}${deg.toFixed(0)}°`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className='pointer-events-none flex flex-col items-center gap-1.5'>
      <svg
        width={WHEEL_PX}
        height={WHEEL_PX}
        viewBox={`-${WHEEL_PX / 2} -${WHEEL_PX / 2} ${WHEEL_PX} ${WHEEL_PX}`}
        className='text-white/85'
      >
        <g ref={wheelRef}>
          <circle r={WHEEL_PX / 2 - 3} fill='none' stroke='currentColor' strokeWidth={2.5} />
          <circle r={3} fill='currentColor' />
          <line
            x1={0}
            y1={-(WHEEL_PX / 2 - 3)}
            x2={0}
            y2={-3}
            stroke='currentColor'
            strokeWidth={2}
          />
          <line
            x1={-(WHEEL_PX / 2 - 5)}
            y1={0}
            x2={-3}
            y2={0}
            stroke='currentColor'
            strokeWidth={2}
          />
          <line x1={WHEEL_PX / 2 - 5} y1={0} x2={3} y2={0} stroke='currentColor' strokeWidth={2} />
        </g>
      </svg>
      <span ref={labelRef} className='font-mono text-[10px] tracking-wider text-white/65'>
        +0°
      </span>
      <div className='relative h-[6px]' style={{ width: BAR_WIDTH }}>
        <div className='absolute inset-0 rounded-full bg-white/12' />
        <div
          className='absolute top-0 bottom-0'
          style={{ left: BAR_HALF - 0.5, width: 1, background: 'rgba(255,255,255,0.35)' }}
        />
        <div ref={fillRef} className='absolute top-0 bottom-0 rounded-full' />
      </div>
    </div>
  )
}
