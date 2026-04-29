const CONTROL_LINES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'Click', label: 'Place object' },
  { key: 'R', label: 'Rotate' },
  { key: 'Esc', label: 'Cancel' },
  { key: 'Del', label: 'Delete selected' },
  { key: 'WASD', label: 'Pan camera' },
  { key: 'Right drag', label: 'Rotate' },
  { key: 'Mid drag', label: 'Pan' },
  { key: 'Scroll', label: 'Zoom' },
  { key: 'Q/E', label: 'Rotate 45°' },
  { key: '1/2/3', label: 'View presets' },
  { key: 'Y', label: 'Elevation mode' },
  { key: 'B', label: 'Elevation profile' },
]

export default function ControlsHelp() {
  return (
    <div className='mt-3 p-2.5 bg-white/5 rounded-md'>
      {CONTROL_LINES.map(({ key, label }) => (
        <div key={key} className='text-[#888] text-[11px] mb-1'>
          <span className='text-white bg-white/10 px-1.5 py-0.5 rounded-[3px] mr-1.5 font-mono'>
            {key}
          </span>{' '}
          {label}
        </div>
      ))}
    </div>
  )
}
