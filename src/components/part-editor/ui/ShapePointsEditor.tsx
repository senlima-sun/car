import { useRef, useEffect, useState, useCallback } from 'react'

interface ShapePointsEditorProps {
  points: [number, number][]
  onChange: (points: [number, number][]) => void
  holes?: [number, number][][]
  onHolesChange?: (holes: [number, number][][]) => void
  cornerRadius: number
}

const CANVAS_SIZE = 200
const PADDING = 20
const POINT_RADIUS = 6
const SCALE = (CANVAS_SIZE - PADDING * 2) / 2
const GRID_SNAP = 0.05 // Grid snap increment
const ALIGN_THRESHOLD = 0.03 // Distance threshold for point alignment

// Convert world coords to canvas coords
function toCanvas(x: number, y: number): [number, number] {
  return [PADDING + (x + 0.5) * SCALE, CANVAS_SIZE - PADDING - (y + 0.5) * SCALE]
}

// Convert canvas coords to world coords
function toWorld(cx: number, cy: number): [number, number] {
  return [(cx - PADDING) / SCALE - 0.5, (CANVAS_SIZE - PADDING - cy) / SCALE - 0.5]
}

// Snap value to grid
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

type EditMode = 'outline' | number // 'outline' or hole index

export default function ShapePointsEditor({
  points,
  onChange,
  holes = [],
  onHolesChange,
  cornerRadius: _cornerRadius,
}: ShapePointsEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [editMode, setEditMode] = useState<EditMode>('outline')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [alignGuides, setAlignGuides] = useState<{ x?: number; y?: number }>({})

  // Get current points being edited
  const currentPoints = editMode === 'outline' ? points : holes[editMode] || []

  // Get all points for alignment (outline + all holes)
  const getAllPoints = useCallback((): [number, number][] => {
    const allPts: [number, number][] = [...points]
    holes.forEach(h => allPts.push(...h))
    return allPts
  }, [points, holes])

  // Find alignment with other points (excluding current dragging point)
  const findAlignment = useCallback(
    (
      x: number,
      y: number,
      excludeIndex: number,
    ): { x?: number; y?: number; snappedX: number; snappedY: number } => {
      const allPts = getAllPoints()
      let snappedX = x
      let snappedY = y
      let alignX: number | undefined
      let alignY: number | undefined

      // Check alignment with all points
      for (let i = 0; i < allPts.length; i++) {
        // Skip the point being dragged
        if (editMode === 'outline' && i === excludeIndex) continue
        if (typeof editMode === 'number') {
          const holeStartIdx =
            points.length + holes.slice(0, editMode).reduce((sum, h) => sum + h.length, 0)
          if (i === holeStartIdx + excludeIndex) continue
        }

        const [px, py] = allPts[i]

        // Check X alignment
        if (Math.abs(px - x) < ALIGN_THRESHOLD) {
          snappedX = px
          alignX = px
        }

        // Check Y alignment
        if (Math.abs(py - y) < ALIGN_THRESHOLD) {
          snappedY = py
          alignY = py
        }
      }

      return { x: alignX, y: alignY, snappedX, snappedY }
    },
    [getAllPoints, editMode, points.length, holes],
  )

  // Apply snapping to coordinates
  const applySnap = useCallback(
    (x: number, y: number, excludeIndex: number = -1): [number, number] => {
      if (!snapEnabled) {
        return [Math.max(-0.5, Math.min(1.5, x)), Math.max(-0.5, Math.min(1.5, y))]
      }

      // First try point alignment
      const alignment = findAlignment(x, y, excludeIndex)
      let snappedX = alignment.snappedX
      let snappedY = alignment.snappedY

      // If no alignment found, snap to grid
      if (alignment.x === undefined) {
        snappedX = snapToGrid(x, GRID_SNAP)
      }
      if (alignment.y === undefined) {
        snappedY = snapToGrid(y, GRID_SNAP)
      }

      // Update alignment guides
      setAlignGuides({ x: alignment.x, y: alignment.y })

      // Clamp to bounds
      return [Math.max(-0.5, Math.min(1.5, snappedX)), Math.max(-0.5, Math.min(1.5, snappedY))]
    },
    [snapEnabled, findAlignment],
  )

  // Update points based on edit mode
  const updateCurrentPoints = useCallback(
    (newPoints: [number, number][]) => {
      if (editMode === 'outline') {
        onChange(newPoints)
      } else if (onHolesChange) {
        const newHoles = [...holes]
        newHoles[editMode] = newPoints
        onHolesChange(newHoles)
      }
    },
    [editMode, onChange, onHolesChange, holes],
  )

  // Draw the shape preview
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const pos = PADDING + (i * SCALE) / 2
      ctx.beginPath()
      ctx.moveTo(pos, PADDING)
      ctx.lineTo(pos, CANVAS_SIZE - PADDING)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(PADDING, pos)
      ctx.lineTo(CANVAS_SIZE - PADDING, pos)
      ctx.stroke()
    }

    // Draw center crosshair
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 1
    const center = CANVAS_SIZE / 2
    ctx.beginPath()
    ctx.moveTo(center, PADDING)
    ctx.lineTo(center, CANVAS_SIZE - PADDING)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(PADDING, center)
    ctx.lineTo(CANVAS_SIZE - PADDING, center)
    ctx.stroke()

    // Helper to draw a path
    const drawPath = (
      pathPoints: [number, number][],
      fillColor: string,
      strokeColor: string,
      isActive: boolean,
    ) => {
      if (pathPoints.length === 0) return

      ctx.fillStyle = fillColor
      ctx.beginPath()
      const [startX, startY] = toCanvas(pathPoints[0][0], pathPoints[0][1])
      ctx.moveTo(startX, startY)
      for (let i = 1; i < pathPoints.length; i++) {
        const [px, py] = toCanvas(pathPoints[i][0], pathPoints[i][1])
        ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = strokeColor
      ctx.lineWidth = isActive ? 2 : 1
      ctx.stroke()
    }

    // Draw outer shape fill
    if (points.length > 0) {
      const isOutlineActive = editMode === 'outline'
      drawPath(
        points,
        'rgba(100, 150, 255, 0.2)',
        isOutlineActive ? '#6699ff' : '#445577',
        isOutlineActive,
      )
    }

    // Draw holes (they "cut out" from the shape visually)
    holes.forEach((holePoints, holeIndex) => {
      if (holePoints.length === 0) return
      const isHoleActive = editMode === holeIndex

      // Draw hole fill (darker to show cutout)
      drawPath(
        holePoints,
        'rgba(30, 30, 50, 0.8)',
        isHoleActive ? '#ff6666' : '#774444',
        isHoleActive,
      )
    })

    // Draw points for currently edited path
    if (currentPoints.length === 0) {
      ctx.fillStyle = '#666'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Click to add points', CANVAS_SIZE / 2, CANVAS_SIZE / 2)
      return
    }

    // Draw alignment guides
    if (snapEnabled && draggingIndex !== null) {
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 1

      if (alignGuides.x !== undefined) {
        const [guideX] = toCanvas(alignGuides.x, 0)
        ctx.beginPath()
        ctx.moveTo(guideX, PADDING)
        ctx.lineTo(guideX, CANVAS_SIZE - PADDING)
        ctx.stroke()
      }

      if (alignGuides.y !== undefined) {
        const [, guideY] = toCanvas(0, alignGuides.y)
        ctx.beginPath()
        ctx.moveTo(PADDING, guideY)
        ctx.lineTo(CANVAS_SIZE - PADDING, guideY)
        ctx.stroke()
      }

      ctx.setLineDash([])
    }

    // Draw points
    const pointColor = editMode === 'outline' ? '#6699ff' : '#ff6666'
    currentPoints.forEach((point, i) => {
      const [cx, cy] = toCanvas(point[0], point[1])
      const isHovered = hoveredIndex === i
      const isDragging = draggingIndex === i

      // Point circle
      ctx.beginPath()
      ctx.arc(cx, cy, POINT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = isDragging ? '#ffcc00' : isHovered ? '#ff6666' : '#ffffff'
      ctx.fill()
      ctx.strokeStyle = pointColor
      ctx.lineWidth = 2
      ctx.stroke()

      // Point index label
      ctx.fillStyle = '#333'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i + 1), cx, cy)
    })
  }, [
    points,
    holes,
    currentPoints,
    hoveredIndex,
    draggingIndex,
    editMode,
    snapEnabled,
    alignGuides,
  ])

  useEffect(() => {
    draw()
  }, [draw])

  const findPointAtPosition = (cx: number, cy: number): number => {
    for (let i = 0; i < currentPoints.length; i++) {
      const [px, py] = toCanvas(currentPoints[i][0], currentPoints[i][1])
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
      // Right-click: delete point
      e.preventDefault()
      if (pointIndex >= 0 && currentPoints.length > 3) {
        const newPoints = currentPoints.filter((_, i) => i !== pointIndex)
        updateCurrentPoints(newPoints)
      }
      return
    }

    if (pointIndex >= 0) {
      // Start dragging existing point
      setDraggingIndex(pointIndex)
    } else {
      // Add new point with snapping
      const [wx, wy] = toWorld(cx, cy)
      const [snappedX, snappedY] = applySnap(wx, wy, -1)
      const newPoints = [...currentPoints, [snappedX, snappedY] as [number, number]]
      updateCurrentPoints(newPoints)
      setAlignGuides({}) // Clear guides after adding
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    if (draggingIndex !== null) {
      // Update dragged point position with snapping
      const [wx, wy] = toWorld(cx, cy)
      const [snappedX, snappedY] = applySnap(wx, wy, draggingIndex)
      const newPoints = [...currentPoints]
      newPoints[draggingIndex] = [snappedX, snappedY]
      updateCurrentPoints(newPoints)
    } else {
      // Update hover state
      const pointIndex = findPointAtPosition(cx, cy)
      setHoveredIndex(pointIndex >= 0 ? pointIndex : null)
      setAlignGuides({}) // Clear guides when not dragging
    }
  }

  const handleMouseUp = () => {
    setDraggingIndex(null)
    setAlignGuides({}) // Clear guides when done dragging
  }

  const handleMouseLeave = () => {
    setDraggingIndex(null)
    setHoveredIndex(null)
    setAlignGuides({})
  }

  const handleReset = () => {
    if (editMode === 'outline') {
      // Reset to default house shape
      onChange([
        [0, 0],
        [1, 0],
        [1, 0.6],
        [0.5, 1],
        [0, 0.6],
      ])
    } else {
      // Reset hole to small rectangle
      updateCurrentPoints([
        [0.3, 0.2],
        [0.7, 0.2],
        [0.7, 0.4],
        [0.3, 0.4],
      ])
    }
  }

  const handleAddHole = () => {
    if (!onHolesChange) return
    // Add a small rectangle hole in the center
    const newHole: [number, number][] = [
      [0.3, 0.2],
      [0.7, 0.2],
      [0.7, 0.4],
      [0.3, 0.4],
    ]
    const newHoles = [...holes, newHole]
    onHolesChange(newHoles)
    setEditMode(newHoles.length - 1)
  }

  const handleDeleteHole = () => {
    if (!onHolesChange || typeof editMode !== 'number') return
    const newHoles = holes.filter((_, i) => i !== editMode)
    onHolesChange(newHoles)
    setEditMode('outline')
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
      {/* Mode tabs */}
      <div
        style={{
          marginBottom: '8px',
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          style={editMode === 'outline' ? activeButtonStyle : buttonStyle}
          onClick={() => setEditMode('outline')}
        >
          Outline
        </button>
        {holes.map((_, i) => (
          <button
            key={i}
            style={editMode === i ? { ...activeButtonStyle, background: '#705050' } : buttonStyle}
            onClick={() => setEditMode(i)}
          >
            Hole {i + 1}
          </button>
        ))}
        {onHolesChange && (
          <button style={buttonStyle} onClick={handleAddHole} title='Add a hole'>
            + Hole
          </button>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button
            style={snapEnabled ? { ...activeButtonStyle, background: '#3a6050' } : buttonStyle}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title='Toggle grid snapping (0.25 grid + point alignment)'
          >
            Snap {snapEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '8px', fontSize: '10px', color: '#888' }}>
        {editMode === 'outline'
          ? 'Editing outer shape'
          : `Editing hole ${(editMode as number) + 1}`}{' '}
        - Click to add, drag to move, right-click to delete
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
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
          Reset
        </button>
        {typeof editMode === 'number' && onHolesChange && (
          <button style={{ ...buttonStyle, background: '#703a3a' }} onClick={handleDeleteHole}>
            Delete Hole
          </button>
        )}
        <span style={{ fontSize: '10px', color: '#666', marginLeft: 'auto' }}>
          {currentPoints.length} pts
          {holes.length > 0 && ` | ${holes.length} hole${holes.length > 1 ? 's' : ''}`}
        </span>
      </div>
    </div>
  )
}
