import { useCustomizationStore } from '../../../../stores/useCustomizationStore'

export default function StatsFooter() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  return (
    <div
      className={`text-[11px] mt-2.5 pt-2.5 border-t border-[#333] ${
        placedObjects.length > 200 ? 'text-[#f59e0b]' : 'text-[#666]'
      }`}
    >
      Objects: {placedObjects.length}
      {placedObjects.length > 200 && ' (performance may be affected)'}
    </div>
  )
}
