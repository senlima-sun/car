import { useState, lazy, Suspense } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { useGameStore } from '@/stores/useGameStore'
import {
  CONTROLS,
  CONTROL_CATEGORIES,
  type ControlCategory,
  type ControlDefinition,
} from '@/constants/controls'

const DebugPanel = lazy(() => import('../HUD/DebugPanel'))

const EDITOR_SHORTCUTS = [
  {
    section: 'Placement',
    items: [
      { key: 'Click', description: 'Place object / Set point' },
      { key: 'R', description: 'Rotate object 90 degrees' },
      { key: 'Esc', description: 'Cancel current action' },
    ],
  },
  {
    section: 'Editing',
    items: [
      { key: 'Del', description: 'Delete selected object' },
      { key: 'Backspace', description: 'Delete selected object' },
    ],
  },
  {
    section: 'Camera',
    items: [
      { key: 'WASD', description: 'Pan camera' },
      { key: 'Scroll', description: 'Zoom in/out' },
    ],
  },
  {
    section: 'Mode',
    items: [{ key: 'F1', description: 'Toggle editor / race mode' }],
  },
]

type TabId = 'controls' | 'editor' | 'debug' | 'settings'

function KeyBadge({ keyName }: { keyName: string }) {
  return (
    <span className='bg-white/15 px-2.5 py-1.5 rounded font-mono text-[11px] font-bold text-white min-w-[24px] text-center shadow-[0_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10'>
      {keyName}
    </span>
  )
}

function ControlRow({
  control,
  isTestingMode,
}: {
  control: ControlDefinition
  isTestingMode: boolean
}) {
  const isDisabled = control.testingModeOnly && !isTestingMode
  return (
    <div className='flex items-center py-1.5 gap-3'>
      <div className={`flex gap-1 shrink-0 ${isDisabled ? 'opacity-40' : ''}`}>
        {control.keys.map((key, idx) => (
          <KeyBadge key={idx} keyName={key} />
        ))}
      </div>
      <div className='flex-1 h-px bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.2)_0px,rgba(255,255,255,0.2)_4px,transparent_4px,transparent_8px)] min-w-[20px]' />
      <span
        className={`text-white text-[13px] shrink-0 ${isDisabled ? 'opacity-40' : 'opacity-90'}`}
      >
        {control.displayName}
      </span>
      {control.testingModeOnly && !isTestingMode && (
        <span className='text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 ml-2'>
          TEST
        </span>
      )}
    </div>
  )
}

function CategorySection({
  category,
  controls,
  isTestingMode,
}: {
  category: ControlCategory
  controls: ControlDefinition[]
  isTestingMode: boolean
}) {
  const info = CONTROL_CATEGORIES[category]
  const isLocked = category === 'testingMode' && !isTestingMode

  return (
    <div className='flex-1'>
      <div className='flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/10'>
        <span className='w-2 h-2 rounded-full' style={{ background: info.color }} />
        <span
          className='text-[12px] font-bold uppercase tracking-wider'
          style={{ color: info.color }}
        >
          {info.label}
        </span>
        {isLocked && (
          <span className='ml-auto text-[10px] px-2 py-0.5 rounded bg-red-500/30 text-red-500'>
            LOCKED
          </span>
        )}
      </div>
      {controls.map(c => (
        <ControlRow key={c.id} control={c} isTestingMode={isTestingMode} />
      ))}
    </div>
  )
}

function ControlsTab({ isTestingMode }: { isTestingMode: boolean }) {
  const byCategory = (cat: ControlCategory) => CONTROLS.filter(c => c.category === cat)

  return (
    <div>
      <div className='flex gap-6 mb-5'>
        <CategorySection
          category='movement'
          controls={byCategory('movement')}
          isTestingMode={isTestingMode}
        />
        <div className='w-px bg-white/10 self-stretch' />
        <CategorySection
          category='drivingSystems'
          controls={byCategory('drivingSystems')}
          isTestingMode={isTestingMode}
        />
      </div>
      {(['camera', 'racingMode', 'testingMode'] as ControlCategory[]).map(cat => (
        <div key={cat} className='mb-5'>
          <CategorySection
            category={cat}
            controls={byCategory(cat)}
            isTestingMode={isTestingMode}
          />
        </div>
      ))}
    </div>
  )
}

function EditorTab() {
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

function DebugTab() {
  return (
    <div className='pointer-events-auto'>
      <Suspense fallback={<div className='text-white/50 text-sm'>Loading...</div>}>
        <DebugPanel />
      </Suspense>
    </div>
  )
}

function SettingsTab() {
  const isTestingMode = useGameStore(s => s.isTestingMode)
  const toggleTestingMode = useGameStore(s => s.toggleTestingMode)
  const lookSensitivity = useGameStore(s => s.lookSensitivity)
  const setLookSensitivity = useGameStore(s => s.setLookSensitivity)

  return (
    <div>
      <div className='flex justify-between items-center py-2 mb-4'>
        <div>
          <div className='text-white text-[13px] font-medium'>Look Sensitivity</div>
          <div className='text-white/40 text-[11px] mt-0.5'>
            Mouse look speed in first-person view
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <input
            type='range'
            min={0.0005}
            max={0.005}
            step={0.0005}
            value={lookSensitivity}
            onChange={e => setLookSensitivity(Number(e.target.value))}
            className='w-[120px] accent-white/60'
          />
          <span className='text-white/70 text-[12px] font-mono w-[44px] text-right'>
            {lookSensitivity.toFixed(4)}
          </span>
        </div>
      </div>

      <div className='flex justify-between items-center py-2'>
        <div>
          <div className='text-white text-[13px] font-medium'>Testing Mode</div>
          <div className='text-white/40 text-[11px] mt-0.5'>
            Unlocks debug tools, environment controls, and testing shortcuts
          </div>
        </div>
        <button
          onClick={toggleTestingMode}
          className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${
            isTestingMode ? 'bg-red-500' : 'bg-white/20'
          }`}
        >
          <div
            className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] transition-[left] ${
              isTestingMode ? 'left-[23px]' : 'left-[3px]'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

const TABS: { id: TabId; label: string; debugOnly?: boolean }[] = [
  { id: 'controls', label: 'Controls' },
  { id: 'editor', label: 'Editor' },
  { id: 'debug', label: 'Debug', debugOnly: true },
  { id: 'settings', label: 'Settings' },
]

export default function SettingsDialog() {
  const isOpen = useGameStore(s => s.isSettingsOpen)
  const closeSettings = useGameStore(s => s.closeSettings)
  const isTestingMode = useGameStore(s => s.isTestingMode)
  const [activeTab, setActiveTab] = useState<TabId>('controls')

  const visibleTabs = TABS.filter(t => !t.debugOnly || isTestingMode)

  const safeTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : 'controls'

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => {
        if (!open) closeSettings()
      }}
      dismissible
    >
      <Dialog.Portal>
        <Dialog.Backdrop className='fixed inset-0 bg-black/60 z-[1000] backdrop-blur-sm' />
        <Dialog.Popup className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-[rgba(20,20,20,0.95)] rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-[680px] max-w-[90vw] max-h-[85vh] flex overflow-hidden pointer-events-auto'>
          <nav className='w-[160px] shrink-0 bg-white/[0.03] border-r border-white/10 p-3 flex flex-col gap-1'>
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
