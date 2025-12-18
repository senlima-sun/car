import { usePartEditorStore } from '../store'
import ShapePointsEditor from './ShapePointsEditor'
import HeightProfileEditor from './HeightProfileEditor'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: '#3a3a50',
  border: '1px solid #4a4a60',
  borderRadius: '4px',
  color: '#eee',
  fontSize: '13px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#888',
  marginBottom: '4px',
  display: 'block',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '16px',
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '6px',
  marginBottom: '8px',
}

interface Vector3InputProps {
  label: string
  value: [number, number, number]
  onChange: (value: [number, number, number]) => void
}

function Vector3Input({ label, value, onChange }: Vector3InputProps) {
  const labels = ['X', 'Y', 'Z']
  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{label}</label>
      <div style={rowStyle}>
        {value.map((v, i) => (
          <div key={i}>
            <span style={{ fontSize: '10px', color: '#666' }}>{labels[i]}</span>
            <input
              type='number'
              style={inputStyle}
              value={v}
              step={0.01}
              onChange={e => {
                const newValue = [...value] as [number, number, number]
                newValue[i] = parseFloat(e.target.value) || 0
                onChange(newValue)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function GeometryArgsEditor({
  geometryType,
  args,
  onChange,
}: {
  geometryType: string
  args: number[]
  onChange: (args: number[]) => void
}) {
  const argLabels: Record<string, string[]> = {
    box: ['Width', 'Height', 'Depth'],
    cylinder: ['Radius Top', 'Radius Bottom', 'Height', 'Segments'],
    sphere: ['Radius', 'Width Segs', 'Height Segs'],
    torus: ['Radius', 'Tube', 'Radial Segs', 'Tubular Segs'],
    cone: ['Radius', 'Height', 'Segments'],
    capsule: ['Radius', 'Length', 'Cap Segs', 'Radial Segs'],
    roundedbox: ['Width', 'Height', 'Depth', 'Smoothness', 'Radius'],
    extrude: ['Depth', 'Corner Radius', 'Bevel Segs'],
  }

  const labels = argLabels[geometryType] || []

  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>Geometry</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {args.map((val, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#888', width: '80px' }}>
              {labels[i] || `Arg ${i}`}
            </span>
            <input
              type='number'
              style={{ ...inputStyle, flex: 1 }}
              value={val}
              step={0.01}
              min={0}
              onChange={e => {
                const newArgs = [...args]
                newArgs[i] = parseFloat(e.target.value) || 0
                onChange(newArgs)
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PropertiesPanel() {
  const selectedPart = usePartEditorStore(s => s.getSelectedPart())
  const updatePart = usePartEditorStore(s => s.updatePart)
  const pushHistory = usePartEditorStore(s => s.pushHistory)
  const duplicatePart = usePartEditorStore(s => s.duplicatePart)
  const removePart = usePartEditorStore(s => s.removePart)
  const renamePart = usePartEditorStore(s => s.renamePart)

  if (!selectedPart) {
    return (
      <div>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '12px',
            color: '#888',
            textTransform: 'uppercase',
          }}
        >
          Properties
        </h3>
        <div style={{ color: '#666', fontSize: '12px', padding: '8px' }}>
          Select a part to edit its properties.
        </div>
      </div>
    )
  }

  const handleChange = (updates: Partial<typeof selectedPart>) => {
    updatePart(selectedPart.id, updates)
  }

  const handleBlur = () => {
    pushHistory()
  }

  return (
    <div>
      <h3
        style={{
          margin: '0 0 12px 0',
          fontSize: '12px',
          color: '#888',
          textTransform: 'uppercase',
        }}
      >
        Properties
      </h3>

      {/* Name */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Name</label>
        <input
          type='text'
          style={inputStyle}
          value={selectedPart.name}
          onChange={e => renamePart(selectedPart.id, e.target.value)}
        />
      </div>

      {/* Transform */}
      <Vector3Input
        label='Position'
        value={selectedPart.position}
        onChange={v => handleChange({ position: v })}
      />

      <Vector3Input
        label='Rotation (rad)'
        value={selectedPart.rotation}
        onChange={v => handleChange({ rotation: v })}
      />

      <Vector3Input
        label='Scale'
        value={selectedPart.scale}
        onChange={v => handleChange({ scale: v })}
      />

      {/* Geometry */}
      <GeometryArgsEditor
        geometryType={selectedPart.geometryType}
        args={selectedPart.args}
        onChange={args => {
          handleChange({ args })
          pushHistory()
        }}
      />

      {/* Shape Points Editor for Extrude */}
      {selectedPart.geometryType === 'extrude' && selectedPart.points && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Shape Outline</label>
          <ShapePointsEditor
            points={selectedPart.points}
            onChange={points => {
              handleChange({ points })
              pushHistory()
            }}
            holes={selectedPart.holes}
            onHolesChange={holes => {
              handleChange({ holes })
              pushHistory()
            }}
            cornerRadius={selectedPart.args[1] || 0}
          />
        </div>
      )}

      {/* Height Profile Editor for Extrude */}
      {selectedPart.geometryType === 'extrude' && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Depth Profile (Z depth by X position)</label>
          <HeightProfileEditor
            profile={
              selectedPart.heightProfile || [
                [0, 1],
                [1, 1],
              ]
            }
            onChange={heightProfile => {
              handleChange({ heightProfile })
              pushHistory()
            }}
            smooth={selectedPart.heightProfileSmooth ?? true}
            onSmoothChange={heightProfileSmooth => {
              handleChange({ heightProfileSmooth })
              pushHistory()
            }}
          />
        </div>
      )}

      {/* Material */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Material</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#888', width: '60px' }}>Color</span>
          <input
            type='color'
            style={{ width: '40px', height: '28px', border: 'none', cursor: 'pointer' }}
            value={selectedPart.color}
            onChange={e => handleChange({ color: e.target.value })}
            onBlur={handleBlur}
          />
          <input
            type='text'
            style={{ ...inputStyle, flex: 1 }}
            value={selectedPart.color}
            onChange={e => handleChange({ color: e.target.value })}
            onBlur={handleBlur}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#888', width: '60px' }}>Metalness</span>
          <input
            type='range'
            style={{ flex: 1 }}
            min={0}
            max={1}
            step={0.05}
            value={selectedPart.metalness}
            onChange={e => handleChange({ metalness: parseFloat(e.target.value) })}
            onMouseUp={handleBlur}
          />
          <span style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>
            {selectedPart.metalness.toFixed(2)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#888', width: '60px' }}>Roughness</span>
          <input
            type='range'
            style={{ flex: 1 }}
            min={0}
            max={1}
            step={0.05}
            value={selectedPart.roughness}
            onChange={e => handleChange({ roughness: parseFloat(e.target.value) })}
            onMouseUp={handleBlur}
          />
          <span style={{ fontSize: '11px', color: '#aaa', width: '30px' }}>
            {selectedPart.roughness.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button
          style={{
            flex: 1,
            padding: '8px',
            background: '#3a5070',
            border: 'none',
            borderRadius: '4px',
            color: '#eee',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onClick={() => duplicatePart(selectedPart.id)}
        >
          Duplicate
        </button>
        <button
          style={{
            flex: 1,
            padding: '8px',
            background: '#703a3a',
            border: 'none',
            borderRadius: '4px',
            color: '#eee',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          onClick={() => removePart(selectedPart.id)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
