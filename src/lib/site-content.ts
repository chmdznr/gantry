import { like } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { portalSettings } from '@/db/schema'
import { BRAND } from '@/lib/brand'

export const CONTENT_LOCALES = ['en', 'id'] as const
export type ContentLocale = (typeof CONTENT_LOCALES)[number]

// base → { label, group, perLocale }. Order = render order in the admin form.
export const CONTENT_FIELDS = [
  { base: 'appName', label: 'App name', group: 'Branding', perLocale: false },
  { base: 'tagline', label: 'Tagline', group: 'Branding', perLocale: true },
  { base: 'heroTitle', label: 'Hero title', group: 'Landing', perLocale: true },
  { base: 'heroText', label: 'Hero text', group: 'Landing', perLocale: true },
  { base: 'ctaStart', label: 'CTA — start', group: 'Landing', perLocale: true },
  { base: 'ctaCatalog', label: 'CTA — catalog', group: 'Landing', perLocale: true },
  { base: 'footer', label: 'Footer text', group: 'Footer', perLocale: true },
] as const

export type ContentBase = (typeof CONTENT_FIELDS)[number]['base']

export function contentKey(base: string, loc?: string): string {
  return loc ? `content.${base}.${loc}` : `content.${base}`
}

export type SiteContent = {
  appName: string; tagline: string; heroTitle: string; heroText: string;
  ctaStart: string; ctaCatalog: string; footer: string;
}
export type ContentDefaults = SiteContent

// Pure resolution: stored row (trimmed, non-empty) wins, else the default.
export function resolveContent(rows: Map<string, string>, locale: string, def: ContentDefaults): SiteContent {
  const get = (base: string, per: boolean, fallback: string) => {
    const v = rows.get(per ? contentKey(base, locale) : contentKey(base))?.trim()
    return v && v.length > 0 ? v : fallback
  }
  const appName = get('appName', false, def.appName)
  const tagline = get('tagline', true, def.tagline)
  return {
    appName,
    tagline,
    heroTitle: get('heroTitle', true, def.heroTitle),
    heroText: get('heroText', true, def.heroText),
    ctaStart: get('ctaStart', true, def.ctaStart),
    ctaCatalog: get('ctaCatalog', true, def.ctaCatalog),
    footer: get('footer', true, def.footer),
  }
}

export async function getContentDefaults(locale: string): Promise<ContentDefaults> {
  const t = await getTranslations({ locale, namespace: 'landing' })
  const footer = `${BRAND.name} — ${BRAND.tagline}`
  return {
    appName: BRAND.name,
    tagline: BRAND.tagline,
    heroTitle: t('heroTitle'),
    heroText: t('heroText'),
    ctaStart: t('ctaStart'),
    ctaCatalog: t('ctaCatalog'),
    footer,
  }
}

async function loadRows(): Promise<Map<string, string>> {
  try {
    const rows = await db.select().from(portalSettings).where(like(portalSettings.key, 'content.%'))
    return new Map(rows.map((r) => [r.key, r.value]))
  } catch {
    return new Map()
  }
}

export async function getSiteContent(locale: string): Promise<SiteContent> {
  const [rows, def] = await Promise.all([loadRows(), getContentDefaults(locale)])
  return resolveContent(rows, locale, def)
}

export async function getAppName(): Promise<string> {
  return (await loadRows()).get('content.appName')?.trim() || BRAND.name
}
