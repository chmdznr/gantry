import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { portalSettings } from '@/db/schema'

// Site-wide themes. Key dipakai sebagai data-theme di <html>; blok CSS-nya di globals.css.
export const THEMES = [
  {
    key: 'atlas',
    name: 'Atlas',
    description: 'Deep spruce and signal coral — the Gantry default.',
    swatch: ['#f2f4f1', '#0c1f1a', '#ff5d33'],
  },
  {
    key: 'mainline',
    name: 'Mainline',
    description: 'Spruce with an electric lime signal.',
    swatch: ['#f2f4f1', '#0c1f1a', '#8fbf00'],
  },
  {
    key: 'heritage',
    name: 'Heritage',
    description: 'Spruce with an archival gold accent.',
    swatch: ['#f2f4f1', '#0c1f1a', '#c9a227'],
  },
  {
    key: 'horizon',
    name: 'Horizon',
    description: 'Spruce with a corporate sky-blue accent.',
    swatch: ['#f2f4f1', '#0c1f1a', '#2f6ba8'],
  },
  {
    key: 'twilight',
    name: 'Twilight',
    description: 'Spruce with a deep indigo accent.',
    swatch: ['#f2f4f1', '#0c1f1a', '#6a5cff'],
  },
  {
    key: 'semaphore',
    name: 'Semaphore',
    description: 'Spruce with a signal-red accent.',
    swatch: ['#f2f4f1', '#0c1f1a', '#da3a2c'],
  },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

export const DEFAULT_THEME: ThemeKey = 'atlas'

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
