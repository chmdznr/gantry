import { describe, expect, it } from 'vitest'
import { parseSpecText, specsEqual } from '@/lib/spec-edit'

describe('parseSpecText', () => {
  it('rejects invalid JSON with an error', () => {
    expect(parseSpecText('{oops').error).toMatch(/JSON tidak valid/)
  })

  it('rejects JSON without a paths object', () => {
    expect(parseSpecText('{"openapi":"3.0.0"}').error).toMatch(/paths/)
    expect(parseSpecText('"just a string"').error).toMatch(/paths/)
  })

  it('accepts a valid OpenAPI spec', () => {
    const { error, spec } = parseSpecText('{"openapi":"3.0.0","paths":{"/x":{}}}')
    expect(error).toBeUndefined()
    expect((spec as { paths: object }).paths).toEqual({ '/x': {} })
  })

  it('auto-converts a Postman Collection v2', () => {
    const col = JSON.stringify({
      info: { name: 'demo', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [{ name: 'get x', request: { method: 'GET', url: { path: ['x'] } } }],
    })
    const { error, spec } = parseSpecText(col)
    expect(error).toBeUndefined()
    expect(Object.keys((spec as { paths: object }).paths).length).toBeGreaterThan(0)
  })
})

describe('specsEqual', () => {
  it('ignores key order (jsonb round-trip)', () => {
    expect(specsEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true)
  })

  it('detects real differences, including array order', () => {
    expect(specsEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(specsEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
    expect(specsEqual(null, { a: 1 })).toBe(false)
  })
})
