import { describe, expect, it } from 'vitest'
import { isEndpointRoutable, matchesSpecOperation, type GatewayRoute } from '../routable'

const routes = (r: Partial<GatewayRoute>[]): GatewayRoute[] =>
  r.map((x) => ({ paths: x.paths ?? [], methods: x.methods ?? null }))

describe('isEndpointRoutable', () => {
  it('matches exact path, any method when route has no method filter', () => {
    const r = routes([{ paths: ['/payments'] }])
    expect(isEndpointRoutable('/payments', 'GET', r)).toBe(true)
    expect(isEndpointRoutable('/payments', 'DELETE', r)).toBe(true)
  })

  it('matches templated subpaths via Kong prefix semantics', () => {
    const r = routes([{ paths: ['/payments'] }])
    expect(isEndpointRoutable('/payments/{id}', 'GET', r)).toBe(true)
    expect(isEndpointRoutable('/payments/{id}/refunds', 'POST', r)).toBe(true)
  })

  it('rejects methods outside the route method filter', () => {
    const r = routes([{ paths: ['/payments'], methods: ['POST'] }])
    expect(isEndpointRoutable('/payments', 'POST', r)).toBe(true)
    expect(isEndpointRoutable('/payments/{id}', 'GET', r)).toBe(false)
  })

  it('rejects paths no route prefixes', () => {
    const r = routes([{ paths: ['/payments'] }])
    expect(isEndpointRoutable('/refunds', 'GET', r)).toBe(false)
  })

  it('is conservative: regex routes and pathless routes count as match', () => {
    expect(isEndpointRoutable('/anything', 'GET', routes([{ paths: ['~/pay.*'] }]))).toBe(true)
    expect(isEndpointRoutable('/anything', 'GET', routes([{ paths: [] }]))).toBe(true)
  })

  it('no routes at all -> nothing routable', () => {
    expect(isEndpointRoutable('/payments', 'GET', [])).toBe(false)
  })
})

describe('matchesSpecOperation', () => {
  const paths = {
    '/payments': { get: {}, post: {} },
    '/payments/{id}': { get: {} },
    '/payments/{id}/refunds': { post: {} },
  }

  it('matches documented literal + method', () => {
    expect(matchesSpecOperation('/payments', 'GET', paths)).toBe(true)
    expect(matchesSpecOperation('/payments', 'POST', paths)).toBe(true)
  })

  it('matches templated segment with a concrete value', () => {
    expect(matchesSpecOperation('/payments/123', 'GET', paths)).toBe(true)
    expect(matchesSpecOperation('/payments/123/refunds', 'POST', paths)).toBe(true)
  })

  it('rejects undocumented deeper path (the probing case)', () => {
    expect(matchesSpecOperation('/payments/123/secret', 'GET', paths)).toBe(false)
    expect(matchesSpecOperation('/payments/123/refunds/x', 'POST', paths)).toBe(false)
  })

  it('rejects wrong method on a documented path', () => {
    expect(matchesSpecOperation('/payments/123', 'DELETE', paths)).toBe(false)
    expect(matchesSpecOperation('/payments/123/refunds', 'GET', paths)).toBe(false)
  })

  it('rejects segment-count mismatch and unknown prefixes', () => {
    expect(matchesSpecOperation('/payments/123/refunds', 'GET', paths)).toBe(false)
    expect(matchesSpecOperation('/admin', 'GET', paths)).toBe(false)
  })

  it('ignores query string when matching', () => {
    expect(matchesSpecOperation('/payments?limit=10', 'GET', paths)).toBe(true)
  })
})
