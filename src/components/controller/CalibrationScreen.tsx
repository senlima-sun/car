import { useState } from 'react'

interface CalibrationScreenProps {
  currentGamma: number
  steerPreview: number
  onCalibrate: () => void
  onComplete: () => void
}

export function CalibrationScreen({ currentGamma, steerPreview, onCalibrate, onComplete }: CalibrationScreenProps) {
  const [step, setStep] = useState<'hold' | 'preview'>('hold')

  return (
    <div className="flex flex-col items-center justify-center h-full bg-neutral-900 text-white p-8">
      {step === 'hold' && (
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-medium">Calibrate Steering</h2>
          <p className="text-neutral-400 text-lg max-w-xs">
            Hold your phone in your comfortable driving position, then tap the button.
          </p>
          <div className="text-neutral-500 text-sm font-mono">
            Tilt: {currentGamma.toFixed(1)}
          </div>
          <button
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white px-8 py-4 rounded-lg text-lg font-medium"
            onClick={() => {
              onCalibrate()
              setStep('preview')
            }}
          >
            Set Center
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="text-center space-y-6 w-full max-w-md">
          <h2 className="text-2xl font-medium">Test Steering</h2>
          <p className="text-neutral-400">Tilt left and right to test</p>

          <div className="w-full h-4 bg-neutral-800 rounded-full relative overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-neutral-600" />
            <div
              className="absolute top-0 bottom-0 w-3 bg-blue-500 rounded-full transition-transform"
              style={{
                left: `${50 + steerPreview * 50}%`,
                transform: 'translateX(-50%)',
              }}
            />
          </div>

          <div className="text-neutral-500 text-sm font-mono">
            Steer: {steerPreview.toFixed(2)}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              className="bg-neutral-700 hover:bg-neutral-600 text-white px-6 py-3 rounded-lg"
              onClick={() => setStep('hold')}
            >
              Recalibrate
            </button>
            <button
              className="bg-green-600 hover:bg-green-500 active:bg-green-400 text-white px-6 py-3 rounded-lg"
              onClick={onComplete}
            >
              Start Driving
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
