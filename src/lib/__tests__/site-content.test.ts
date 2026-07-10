import { describe, expect, it, vi } from 'vitest'
import type { ContentDefaults } from '../site-content'

// site-content.ts imports '@/db' at module scope, and db/index.ts throws eagerly when
// DATABASE_URL isn't set. Mock it so these pure-function tests don't need a real DB
// (same pattern as themes.test.ts / authorize.test.ts).
vi.mock('@/db', () => ({ db: {} }))

const { resolveContent, contentKey } = await import('../site-content')

const DEF: ContentDefaults = {
  appName: 'Gantry', tagline: 'Dev portal', heroTitle: 'HT', heroText: 'HX',
  ctaStart: 'Start', ctaCatalog: 'Catalog', footer: 'Gantry — Dev portal',
}

describe('contentKey', () => {
  it('builds global and per-locale keys', () => {
    expect(contentKey('appName')).toBe('content.appName')
    expect(contentKey('heroTitle', 'id')).toBe('content.heroTitle.id')
  })
})

describe('resolveContent', () => {
  it('returns defaults when nothing stored', () => {
    expect(resolveContent(new Map(), 'en', DEF)).toEqual(DEF)
  })
  it('overrides app name (global) and per-locale hero title', () => {
    const rows = new Map([['content.appName', 'Acme'], ['content.heroTitle.id', 'Judul']])
    expect(resolveContent(rows, 'id', DEF).appName).toBe('Acme')
    expect(resolveContent(rows, 'id', DEF).heroTitle).toBe('Judul')
    expect(resolveContent(rows, 'en', DEF).heroTitle).toBe('HT') // id override doesn't leak to en
  })
  it('treats whitespace-only as unset (falls back)', () => {
    const rows = new Map([['content.tagline.en', '   ']])
    expect(resolveContent(rows, 'en', DEF).tagline).toBe('Dev portal')
  })
  it('footer default composes from the resolved (overridden) name/tagline', () => {
    const rows = new Map([['content.appName', 'Acme'], ['content.tagline.en', 'The API hub']])
    expect(resolveContent(rows, 'en', DEF).footer).toBe('Acme — The API hub')
  })
})
