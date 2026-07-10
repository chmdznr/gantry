import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))

const { THEMES, DEFAULT_THEME, isThemeKey, DEFAULT_MODE, isMode } = await import('@/lib/themes')

describe('themes', () => {
  it('accepts every registered key and the default', () => {
    for (const t of THEMES) expect(isThemeKey(t.key)).toBe(true)
    expect(isThemeKey(DEFAULT_THEME)).toBe(true)
  })
  it('rejects unknown values', () => {
    for (const bad of ['', 'dark', 'bri', 'legacy ', 'switchyard']) expect(isThemeKey(bad)).toBe(false)
  })
  it('defaults to atlas and atlas is a defined preset', () => {
    expect(DEFAULT_THEME).toBe('atlas')
    expect(THEMES.some((t) => t.key === 'atlas')).toBe(true)
  })
  it('every preset has a 3-color swatch and no legacy fontVar field', () => {
    for (const t of THEMES) {
      expect(t.swatch).toHaveLength(3)
      expect('fontVar' in t).toBe(false)
    }
  })
})

describe('mode', () => {
  it('defaults to system', () => {
    expect(DEFAULT_MODE).toBe('system')
  })
  it('isMode validates light/dark/system and rejects others', () => {
    expect(isMode('light')).toBe(true)
    expect(isMode('dark')).toBe(true)
    expect(isMode('system')).toBe(true)
    expect(isMode('bright')).toBe(false)
    expect(isMode('')).toBe(false)
  })
})
