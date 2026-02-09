import { useRef, useCallback } from 'react'

interface ControlSurfaceProps {
  onThrottleChange: (value: number) => void
  onBrakeChange: (value: number) => void
}

function touchToValue(touch: React.Touch, element: HTMLDivElement): number {
  const rect = element.getBoundingClientRect()
  const y = (touch.clientY - rect.top) / rect.height
  return Math.max(0, Math.min(1, y))
}

export function ControlSurface({ onThrottleChange, onBrakeChange }: ControlSurfaceProps) {
  const throttleRef = useRef<HTMLDivElement>(null)
  const brakeRef = useRef<HTMLDivElement>(null)
  const throttleValueRef = useRef(0)
  const brakeValueRef = useRef(0)

  const handleThrottleTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!throttleRef.current || e.touches.length === 0) return
    const value = touchToValue(e.touches[0], throttleRef.current)
    throttleValueRef.current = value
    onThrottleChange(value)
  }, [onThrottleChange])

  const handleThrottleEnd = useCallback(() => {
    throttleValueRef.current = 0
    onThrottleChange(0)
  }, [onThrottleChange])

  const handleBrakeTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!brakeRef.current || e.touches.length === 0) return
    const value = touchToValue(e.touches[0], brakeRef.current)
    brakeValueRef.current = value
    onBrakeChange(value)
  }, [onBrakeChange])

  const handleBrakeEnd = useCallback(() => {
    brakeValueRef.current = 0
    onBrakeChange(0)
  }, [onBrakeChange])

  return (
    <div className="flex h-full w-full select-none">
      <div
        ref={brakeRef}
        className="w-1/2 h-full flex items-center justify-center relative"
        style={{ background: `rgba(239, 68, 68, ${0.1 + brakeValueRef.current * 0.3})` }}
        onTouchStart={handleBrakeTouch}
        onTouchMove={handleBrakeTouch}
        onTouchEnd={handleBrakeEnd}
        onTouchCancel={handleBrakeEnd}
      >
        <span className="text-red-400/50 text-4xl font-bold pointer-events-none">BRAKE</span>
        <div
          className="absolute bottom-0 left-0 right-0 bg-red-500/30 transition-all"
          style={{ height: `${brakeValueRef.current * 100}%` }}
        />
      </div>
      <div
        ref={throttleRef}
        className="w-1/2 h-full flex items-center justify-center relative"
        style={{ background: `rgba(34, 197, 94, ${0.1 + throttleValueRef.current * 0.3})` }}
        onTouchStart={handleThrottleTouch}
        onTouchMove={handleThrottleTouch}
        onTouchEnd={handleThrottleEnd}
        onTouchCancel={handleThrottleEnd}
      >
        <span className="text-green-400/50 text-4xl font-bold pointer-events-none">GAS</span>
        <div
          className="absolute bottom-0 left-0 right-0 bg-green-500/30 transition-all"
          style={{ height: `${throttleValueRef.current * 100}%` }}
        />
      </div>
    </div>
  )
}
