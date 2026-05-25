import { describe, expect, it } from 'vitest'
import { resolveIconBtnVariant } from './IconButton'
import { iconBtnVariant } from './tokens'

describe('resolveIconBtnVariant', () => {
  it('returns default when no flag is set', () => {
    expect(resolveIconBtnVariant({})).toBe(iconBtnVariant.default)
  })

  it('returns active when active=true', () => {
    expect(resolveIconBtnVariant({ active: true })).toBe(iconBtnVariant.active)
  })

  it('returns primary when primary=true', () => {
    expect(resolveIconBtnVariant({ primary: true })).toBe(iconBtnVariant.primary)
  })

  it('returns danger when danger=true', () => {
    expect(resolveIconBtnVariant({ danger: true })).toBe(iconBtnVariant.danger)
  })

  it('returns disabled when disabled=true (overrides all other flags)', () => {
    expect(resolveIconBtnVariant({ disabled: true })).toBe(iconBtnVariant.disabled)
    expect(resolveIconBtnVariant({ disabled: true, active: true })).toBe(iconBtnVariant.disabled)
    expect(resolveIconBtnVariant({ disabled: true, primary: true })).toBe(iconBtnVariant.disabled)
    expect(resolveIconBtnVariant({ disabled: true, danger: true })).toBe(iconBtnVariant.disabled)
  })

  it('primary beats active when both set (current IconButton priority)', () => {
    expect(resolveIconBtnVariant({ primary: true, active: true })).toBe(iconBtnVariant.primary)
  })

  it('danger beats active when both set', () => {
    expect(resolveIconBtnVariant({ danger: true, active: true })).toBe(iconBtnVariant.danger)
  })
})
