interface ActionButtonsProps {
  onHandbrake: (active: boolean) => void
  onErs: () => void
  onAero: () => void
  onCamera: () => void
}

export function ActionButtons({ onHandbrake, onErs, onAero, onCamera }: ActionButtonsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <button
        className="absolute bottom-4 left-4 pointer-events-auto w-20 h-20 rounded-full bg-orange-600/80 active:bg-orange-500 text-white font-bold text-xs flex items-center justify-center"
        onTouchStart={() => onHandbrake(true)}
        onTouchEnd={() => onHandbrake(false)}
        onTouchCancel={() => onHandbrake(false)}
      >
        HAND
      </button>

      <button
        className="absolute top-4 right-4 pointer-events-auto w-14 h-14 rounded-full bg-blue-600/80 active:bg-blue-500 text-white font-bold text-xs flex items-center justify-center"
        onTouchStart={onErs}
      >
        ERS
      </button>

      <button
        className="absolute top-4 left-4 pointer-events-auto w-14 h-14 rounded-full bg-purple-600/80 active:bg-purple-500 text-white font-bold text-xs flex items-center justify-center"
        onTouchStart={onAero}
      >
        AERO
      </button>

      <button
        className="absolute bottom-4 right-4 pointer-events-auto w-14 h-14 rounded-full bg-neutral-600/80 active:bg-neutral-500 text-white font-bold text-xs flex items-center justify-center"
        onTouchStart={onCamera}
      >
        CAM
      </button>
    </div>
  )
}
