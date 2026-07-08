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
    swatch: ['#f2efe6', '#10312b', '#f5b700', '#1a7f4e'],
  },
  {
    key: 'heritage',
    name: 'Heritage',
    description: 'Archival white, deep navy, and gold with a serif display face.',
    fontVar: 'var(--font-lora)',
    swatch: ['#f7f4ec', '#1c2c54', '#c9a227', '#1a7f4e'],
  },
  {
    key: 'horizon',
    name: 'Horizon',
    description: 'Corporate sky blue with a bright dawn-orange accent.',
    fontVar: 'var(--font-jakarta)',
    swatch: ['#f2f6fa', '#003a70', '#f59823', '#1a7f4e'],
  },
  {
    key: 'twilight',
    name: 'Twilight',
    description: 'Sunset orange over deep indigo — bold and energetic.',
    fontVar: 'var(--font-archivo)',
    swatch: ['#f7f3ef', '#2f318b', '#f08200', '#1a7f4e'],
  },
  {
    key: 'semaphore',
    name: 'Semaphore',
    description: 'Clean white, signal red, and midnight navy.',
    fontVar: 'var(--font-sora)',
    swatch: ['#f8f7f5', '#101d33', '#da3a2c', '#1a7f4e'],
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
