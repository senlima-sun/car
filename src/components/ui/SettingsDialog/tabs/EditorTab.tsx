import { EDITOR_SHORTCUTS } from '../constants/editorShortcuts'

export function EditorTab() {
  return (
    <div>
      {EDITOR_SHORTCUTS.map(section => (
        <div key={section.section} className='mb-5'>
          <div className='text-white/50 text-[10px] uppercase tracking-wider mb-2.5'>
            {section.section}
          </div>
          {section.items.map(item => (
            <div key={item.key} className='flex items-center gap-3 mb-2'>
              <span className='min-w-[60px] px-2 py-1 bg-white/10 rounded text-white text-[11px] font-mono text-center'>
                {item.key}
              </span>
              <span className='text-white/70 text-[12px]'>{item.description}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
