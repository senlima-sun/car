import { describe, expect, it } from 'vitest'
import {
  surface,
  surfacePill,
  surfaceCard,
  surfaceCardStrong,
  labelTag,
  divider,
  dividerHorizontal,
  iconBtnBase,
  iconBtnVariant,
} from './tokens'

describe('tokens', () => {
  it('surface variants match individual literal exports', () => {
    expect(surface.pill).toBe(surfacePill)
    expect(surface.card).toBe(surfaceCard)
    expect(surface.cardStrong).toBe(surfaceCardStrong)
  })

  it('canonical class strings include backdrop-blur for all surfaces', () => {
    expect(surfacePill).toMatch(/backdrop-blur-xl/)
    expect(surfaceCard).toMatch(/backdrop-blur-xl/)
    expect(surfaceCardStrong).toMatch(/backdrop-blur-2xl/)
  })

  it('pill surface uses rounded-full; card surfaces use rounded-2xl', () => {
    expect(surfacePill).toMatch(/rounded-full/)
    expect(surfaceCard).toMatch(/rounded-2xl/)
    expect(surfaceCardStrong).toMatch(/rounded-2xl/)
  })

  it('cardStrong is darker than card', () => {
    expect(surfaceCard).toMatch(/rgba\(14,16,22,0\.82\)/)
    expect(surfaceCardStrong).toMatch(/rgba\(10,12,18,0\.92\)/)
  })

  it('labelTag is uppercase with wide tracking', () => {
    expect(labelTag).toMatch(/uppercase/)
    expect(labelTag).toMatch(/tracking-\[0\.22em\]/)
  })

  it('dividers are 1px and contrast', () => {
    expect(divider).toMatch(/w-px/)
    expect(dividerHorizontal).toMatch(/h-px/)
    expect(divider).toMatch(/bg-white\/10/)
  })

  it('iconBtnBase is 36x36 rounded-full', () => {
    expect(iconBtnBase).toMatch(/h-9/)
    expect(iconBtnBase).toMatch(/w-9/)
    expect(iconBtnBase).toMatch(/rounded-full/)
  })

  it('iconBtnVariant covers all 5 states', () => {
    const keys = Object.keys(iconBtnVariant).sort()
    expect(keys).toEqual(['active', 'danger', 'default', 'disabled', 'primary'])
  })

  it('disabled variant has cursor-not-allowed', () => {
    expect(iconBtnVariant.disabled).toMatch(/cursor-not-allowed/)
  })

  it('primary variant uses sky color', () => {
    expect(iconBtnVariant.primary).toMatch(/sky-500/)
  })

  it('danger variant uses red color', () => {
    expect(iconBtnVariant.danger).toMatch(/red-/)
  })
})
