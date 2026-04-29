import { CONTROLS, type ControlCategory } from '@/constants/controls'
import { CategorySection } from '../components/CategorySection'

export function ControlsTab({ isTestingMode }: { isTestingMode: boolean }) {
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
