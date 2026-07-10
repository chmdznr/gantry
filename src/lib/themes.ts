import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { portalSettings } from '@/db/schema'

// Site-wide themes. Key dipakai sebagai data-theme di <html>; blok CSS-nya di globals.css.
export const THEMES = [
  {
    key: 'switchyard',
    name: 'Switchyard',
    description: 'Warm cream, spruce green, signal amber — the original Gantry look.',
    fontVar: 'var(--font-bricolage)',
    swatch: ['#f2efe6', '#10312b', '#f5b700'],
  },
  {
    key: 'mainline',
    name: 'Mainline',
    description: 'Charcoal black with an electric lime signal — sleek and technical.',
    fontVar: 'var(--font-space)',
    swatch: ['#f4f6f1', '#101613', '#ccff00'],
  },
  {
    key: 'heritage',
    name: 'Heritage',
    description: 'Archival white, deep navy, and gold with a serif display face.',
    fontVar: 'var(--font-lora)',
    swatch: ['#f7f4ec', '#1c2c54', '#c9a227'],
  },
  {
    key: 'horizon',
    name: 'Horizon',
    description: 'Corporate sky blue with a bright dawn-orange accent.',
    fontVar: 'var(--font-jakarta)',
    swatch: ['#f2f6fa', '#003a70', '#f59823'],
  },
  {
    key: 'twilight',
    name: 'Twilight',
    description: 'Sunset orange over deep indigo — bold and energetic.',
    fontVar: 'var(--font-archivo)',
    swatch: ['#f7f3ef', '#2f318b', '#f08200'],
  },
  {
    key: 'semaphore',
    name: 'Semaphore',
    description: 'Clean white, signal red, and midnight navy.',
    fontVar: 'var(--font-sora)',
    swatch: ['#f8f7f5', '#101d33', '#da3a2c'],
  },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

export const DEFAULT_THEME: ThemeKey = 'switchyard'

export function isThemeKey(v: string): v is ThemeKey {
  return THEMES.some((t) => t.key === v)
}

export async function getTheme(): Promise<ThemeKey> {
  try {
    const row = await db.query.portalSettings.findFirst({
      where: eq(portalSettings.key, 'theme'),
    })
    return row && isThemeKey(row.value) ? row.value : DEFAULT_THEME
  } catch {
    // ponytail: layout tidak boleh crash hanya karena setting theme gagal dibaca
    return DEFAULT_THEME
  }
}

export type Mode = 'light' | 'dark' | 'system'

export const DEFAULT_MODE: Mode = 'system'

export function isMode(v: string): v is Mode {
  return v === 'light' || v === 'dark' || v === 'system'
}

export async function getMode(): Promise<Mode> {
  try {
    const row = await db.query.portalSettings.findFirst({
      where: eq(portalSettings.key, 'mode'),
    })
    return row && isMode(row.value) ? (row.value as Mode) : DEFAULT_MODE
  } catch {
    // ponytail: layout tidak boleh crash hanya karena setting mode gagal dibaca
    return DEFAULT_MODE
  }
}
