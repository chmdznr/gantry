import { describe, it, expect } from 'vitest'
import { diffEndpoints, hasBreakingChange, isEmptyDiff } from '../openapi-diff'

const spec = (paths: Record<string, Record<string, unknown>>) => ({ openapi: '3.0.0', paths })

describe('diffEndpoints', () => {
  it('deteksi added, removed, changed', () => {
    const oldS = spec({ '/a': { get: { summary: 'A' } }, '/b': { get: { summary: 'B' } } })
    const newS = spec({ '/a': { get: { summary: 'A diubah' } }, '/c': { post: { summary: 'C' } } })
    const d = diffEndpoints(oldS, newS)
    expect(d.added).toEqual(['POST /c'])
    expect(d.removed).toEqual(['GET /b'])
    expect(d.changed).toEqual(['GET /a'])
  })

  it('spec identik -> diff kosong', () => {
    const s = spec({ '/a': { get: { summary: 'A' } } })
    expect(isEmptyDiff(diffEndpoints(s, s))).toBe(true)
  })

  it('dari tanpa spec -> semua added', () => {
    const d = diffEndpoints(null, spec({ '/a': { get: {} }, '/b': { post: {} } }))
    expect(d.added).toEqual(['GET /a', 'POST /b'])
    expect(d.removed).toEqual([])
  })

  it('abaikan key non-method (mis. parameters di level path)', () => {
    const d = diffEndpoints(null, spec({ '/a': { get: {}, parameters: [] } }))
    expect(d.added).toEqual(['GET /a'])
  })

  it('removed endpoint = breaking', () => {
    const oldS = spec({ '/a': { get: {} } })
    const newS = spec({})
    expect(hasBreakingChange(diffEndpoints(oldS, newS))).toBe(true)
    expect(hasBreakingChange(diffEndpoints(null, oldS))).toBe(false)
  })
})
