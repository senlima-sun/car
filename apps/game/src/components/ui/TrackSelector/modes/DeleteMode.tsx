import { LabelTag } from '@/components/ui/primitives'
import { ConfirmButtons } from '../ConfirmButtons'

export function DeleteMode({
  trackName,
  onConfirm,
  onCancel,
}: {
  trackName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className='py-3'>
      <LabelTag className='block px-3 py-2'>Delete Track</LabelTag>
      <div className='px-3 py-2 text-white/85 text-[13px]'>
        Are you sure you want to delete &quot;{trackName}&quot;?
      </div>
      <ConfirmButtons
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel='Delete'
        variant='danger'
      />
    </div>
  )
}
