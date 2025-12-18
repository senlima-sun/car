import { usePartEditorStore } from '../store'
import PartMesh from './PartMesh'

export default function PartsList() {
  const parts = usePartEditorStore((s) => s.parts)
  const selectedPartId = usePartEditorStore((s) => s.selectedPartId)
  const selectPart = usePartEditorStore((s) => s.selectPart)

  return (
    <group>
      {parts.map((part) => (
        <PartMesh
          key={part.id}
          part={part}
          isSelected={selectedPartId === part.id}
          onClick={selectPart}
        />
      ))}
    </group>
  )
}
