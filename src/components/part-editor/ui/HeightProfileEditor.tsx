import { useRef, useEffect, useState, useCallback } from 'react'

interface HeightProfileEditorProps {
  profile: [number, number][] // [position (0-1), height (0-1)]
  onChange: (profile: [number, number][]) => void
  smooth: boolean
  onSmoothChange: (smooth: boolean) => void
}

const CANVAS_WIDTH = 200
const CANVAS_HEIGHT = 120
const PADDING = 20
const POINT_RADIUS = 5

// Convert world coords (0-1, 0-1) to canvas coords
function toCanvas(x: number, y: number): [number, number] {
  const drawWidth = CANVAS_WIDTH - PADDING * 2
  const drawHeight = CANVAS_HEIGHT - PADDING * 2
  return [PADDING + x * drawWidth, CANVAS_HEIGHT - PADDING - y * drawHeight]
}

// Convert canvas coords to world coords (0-1, 0-1)
function toWorld(cx: number, cy: number): [number, number] {
  const drawWidth = CANVAS_WIDTH - PADDING * 2
  const drawHeight = CANVAS_HEIGHT - PADDING * 2
  return [(cx - PADDING) / drawWidth, (CANVAS_HEIGHT - PADDING - cy) / drawHeight]
}

// Clamp value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Snap value to grid
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export default function HeightProfileEditor({
  profile,
  onChange,
  smooth,
  onSmoothChange,
}: HeightProfileEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [snapEnabled, setSnapEnabled] = useState(true)

  // Sort profile by position
  const sortedProfile = [...profile].sort((a, b) => a[0] - b[0])

  // Draw the profile
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw grid
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1

    // Vertical grid lines (position: 0, 0.25, 0.5, 0.75, 1)
    for (let i = 0; i <= 4; i++) {
      const [x] = toCanvas(i * 0.25, 0)
      ctx.beginPath()
      ctx.moveTo(x, PADDING)
      ctx.lineTo(x, CANVAS_HEIGHT - PADDING)
      ctx.stroke()
    }

    // Horizontal grid lines (height: 0, 0.25, 0.5, 0.75, 1)
    for (let i = 0; i <= 4; i++) {
      const [, y] = toCanvas(0, i * 0.25)
      ctx.beginPath()
      ctx.moveTo(PADDING, y)
      ctx.lineTo(CANVAS_WIDTH - PADDING, y)
      ctx.stroke()
    }

    // Draw axis labels
    ctx.fillStyle = '#666'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('0', PADDING, CANVAS_HEIGHT - 5)
    ctx.fillText('1', CANVAS_WIDTH - PADDING, CANVAS_HEIGHT - 5)
    ctx.fillText('X Position →', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 5)

    ctx.save()
    ctx.translate(8, CANVAS_HEIGHT / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Z Depth', 0, 0)
    ctx.restore()

    // Draw profile curve/steps
    if (sortedProfile.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = '#6699ff'
      ctx.lineWidth = 2

      // Start from left edge at first point's height
      const [firstX, firstY] = toCanvas(0, sortedProfile[0][1])
      ctx.moveTo(firstX, firstY)

      if (smooth) {
        // Smooth interpolation - draw lines between points
        for (let i = 0; i < sortedProfile.length; i++) {
          const [x, y] = toCanvas(sortedProfile[i][0], sortedProfile[i][1])
          ctx.lineTo(x, y)
        }
        // Extend to right edge
        const lastHeight = sortedProfile[sortedProfile.length - 1][1]
        const [lastX, lastY] = toCanvas(1, lastHeight)
        ctx.lineTo(lastX, lastY)
      } else {
        // Stepped - horizontal then vertical
        for (let i = 0; i < sortedProfile.length; i++) {
          const [x, y] = toCanvas(sortedProfile[i][0], sortedProfile[i][1])
          // Horizontal line to this point's x
          ctx.lineTo(
            x,
            ctx.getLineDash().length > 0
              ? firstY
              : i === 0
                ? firstY
                : toCanvas(0, sortedProfile[i - 1][1])[1],
          )
          // Step to this point's height
          const prevY = i === 0 ? firstY : toCanvas(0, sortedProfile[i - 1][1])[1]
          ctx.lineTo(x, prevY)
          ctx.lineTo(x, y)
        }
        // Extend to right edge
        const lastHeight = sortedProfile[sortedProfile.length - 1][1]
        const [lastX, lastY] = toCanvas(1, lastHeight)
        ctx.lineTo(lastX, lastY)
      }

      ctx.stroke()

      // Fill under curve
      ctx.lineTo(CANVAS_WIDTH - PADDING, CANVAS_HEIGHT - PADDING)
      ctx.lineTo(PADDING, CANVAS_HEIGHT - PADDING)
      ctx.closePath()
      ctx.fillStyle = 'rgba(100, 150, 255, 0.15)'
      ctx.fill()
    }

    // Draw points
    sortedProfile.forEach((point, i) => {
      const [cx, cy] = toCanvas(point[0], point[1])
      const isHovered = hoveredIndex === i
      const isDragging = draggingIndex === i
      const isEndpoint = i === 0 || i === sortedProfile.length - 1

      // Point circle
      ctx.beginPath()
      ctx.arc(cx, cy, POINT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = isDragging ? '#ffcc00' : isHovered ? '#ff6666' : '#ffffff'
      ctx.fill()
      ctx.strokeStyle = isEndpoint ? '#ff9944' : '#6699ff'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Instructions if empty
    if (sortedProfile.length === 0) {
      ctx.fillStyle = '#666'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Click to add points', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    }
  }, [sortedProfile, hoveredIndex, draggingIndex, smooth])

  useEffect(() => {
    draw()
  }, [draw])

  const findPointAtPosition = (cx: number, cy: number): number => {
    for (let i = 0; i < sortedProfile.length; i++) {
      const [px, py] = toCanvas(sortedProfile[i][0], sortedProfile[i][1])
      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
      if (dist <= POINT_RADIUS + 4) return i
    }
    return -1
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const pointIndex = findPointAtPosition(cx, cy)

    if (e.button === 2) {
      // Right-click: delete point (but keep at least 2)
      e.preventDefault()
      if (pointIndex >= 0 && sortedProfile.length > 2) {
        const newProfile = sortedProfile.filter((_, i) => i !== pointIndex)
        onChange(newProfile)
      }
      return
    }

    if (pointIndex >= 0) {
      // Start dragging existing point
      setDraggingIndex(pointIndex)
    } else {
      // Add new point
      let [wx, wy] = toWorld(cx, cy)
      if (snapEnabled) {
        wx = snapToGrid(wx, 0.05)
        wy = snapToGrid(wy, 0.1)
      }
      wx = clamp(wx, 0, 1)
      wy = clamp(wy, 0, 1)

      const newProfile = [...sortedProfile, [wx, wy] as [number, number]]
      onChange(newProfile)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    if (draggingIndex !== null) {
      // Update dragged point position
      let [wx, wy] = toWorld(cx, cy)
      if (snapEnabled) {
        wx = snapToGrid(wx, 0.05)
        wy = snapToGrid(wy, 0.1)
      }
      wx = clamp(wx, 0, 1)
      wy = clamp(wy, 0, 1)

      const newProfile = [...sortedProfile]
      newProfile[draggingIndex] = [wx, wy]
      onChange(newProfile)
    } else {
      // Update hover state
      const pointIndex = findPointAtPosition(cx, cy)
      setHoveredIndex(pointIndex >= 0 ? pointIndex : null)
    }
  }

  const handleMouseUp = () => {
    setDraggingIndex(null)
  }

  const handleMouseLeave = () => {
    setDraggingIndex(null)
    setHoveredIndex(null)
  }

  const handleReset = () => {
    // Reset to flat profile
    onChange([
      [0, 1],
      [1, 1],
    ])
  }

  const buttonStyle: React.CSSProperties = {
    padding: '4px 8px',
    background: '#3a3a50',
    border: 'none',
    borderRadius: '4px',
    color: '#eee',
    cursor: 'pointer',
    fontSize: '10px',
  }

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: '#5a5a80',
    boxShadow: '0 0 0 1px #8888ff',
  }

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ marginBottom: '8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          style={smooth ? activeButtonStyle : buttonStyle}
          onClick={() => onSmoothChange(true)}
        >
          Smooth
        </button>
        <button
          style={!smooth ? activeButtonStyle : buttonStyle}
          onClick={() => onSmoothChange(false)}
        >
          Stepped
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button
            style={snapEnabled ? { ...activeButtonStyle, background: '#3a6050' } : buttonStyle}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title='Toggle grid snapping'
          >
            Snap {snapEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '10px', color: '#888' }}>
        Click to add, drag to move, right-click to delete
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: '1px solid #3a3a50',
          borderRadius: '4px',
          cursor:
            draggingIndex !== null ? 'grabbing' : hoveredIndex !== null ? 'grab' : 'crosshair',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={e => e.preventDefault()}
      />

      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button style={buttonStyle} onClick={handleReset}>
          Reset (Flat)
        </button>
        <button
          style={buttonStyle}
          onClick={() =>
            onChange([
              [0, 1],
              [0.3, 1],
              [0.3, 0.5],
              [1, 0.5],
            ])
          }
          title='Create a step-down profile'
        >
          Step Down
        </button>
        <button
          style={buttonStyle}
          onClick={() =>
            onChange([
              [0, 0.5],
              [0.5, 1],
              [1, 0.5],
            ])
          }
          title='Create a peak in the middle'
        >
          Peak
        </button>
        <span style={{ fontSize: '10px', color: '#666', marginLeft: 'auto' }}>
          {sortedProfile.length} pts
        </span>
      </div>
    </div>
  )
}
