import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))

const { THEMES, DEFAULT_THEME, isThemeKey } = await import('@/lib/themes')

describe('themes', () => {
  it('accepts every registered key and the default', () => {
    for (const t of THEMES) expect(isThemeKey(t.key)).toBe(true)
    expect(isThemeKey(DEFAULT_THEME)).toBe(true)
  })
  it('rejects unknown values', () => {
    for (const bad of ['', 'dark', 'bri', 'legacy ']) expect(isThemeKey(bad)).toBe(false)
  })
})
