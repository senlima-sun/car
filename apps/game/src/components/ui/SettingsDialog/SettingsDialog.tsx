import { useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { useGameStore } from '@/stores/useGameStore'
import { useSessionStore } from '@/stores/useSessionStore'

import { TABS, type TabId } from './constants/tabs'
import { ControlsTab } from './tabs/ControlsTab'
import { EditorTab } from './tabs/EditorTab'
import { DebugTab } from './tabs/DebugTab'
import { SettingsTab } from './tabs/SettingsTab'

export default function SettingsDialog() {
  const isOpen = useGameStore(s => s.isSettingsOpen)
  const closeSettings = useGameStore(s => s.closeSettings)
  const isTestingMode = useSessionStore(s => s.config?.testingMode ?? false)
  const [activeTab, setActiveTab] = useState<TabId>('controls')

  const visibleTabs = TABS.filter(t => !t.debugOnly || isTestingMode)
  const safeTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : 'controls'

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) closeSettings()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className='fixed inset-0 bg-black/60 z-1000 backdrop-blur-sm' />
        <Dialog.Popup className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1001 bg-[rgba(20,20,20,0.95)] rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-170 max-w-[90vw] max-h-[85vh] flex overflow-hidden pointer-events-auto'>
          <nav className='w-40 shrink-0 bg-white/3 border-r border-white/10 p-3 flex flex-col gap-1'>
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-left text-[13px] font-medium transition-colors cursor-pointer ${
                  safeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                {tab.label}
                {tab.debugOnly && (
                  <span className='ml-1.5 text-[9px] text-red-500 font-bold'>TEST</span>
                )}
              </button>
            ))}
            <div className='flex-1' />
            <div className='text-white/20 text-[10px] text-center'>ESC to close</div>
          </nav>

          <div className='flex-1 p-6 overflow-y-auto'>
            <Dialog.Title className='text-white text-lg font-bold uppercase tracking-widest mb-5'>
              {visibleTabs.find(t => t.id === safeTab)?.label}
            </Dialog.Title>

            {safeTab === 'controls' && <ControlsTab isTestingMode={isTestingMode} />}
            {safeTab === 'editor' && <EditorTab />}
            {safeTab === 'debug' && <DebugTab />}
            {safeTab === 'settings' && <SettingsTab />}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
