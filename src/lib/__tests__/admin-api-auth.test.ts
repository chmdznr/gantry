import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAdminApiToken } from '../admin-api-tokens'

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  selectCalls: 0,
  updateSets: [] as unknown[],
  updateCalls: 0,
  updateThrows: false,
  rateLimit: vi.fn(async () => true),
}))

vi.mock('@/db', () => ({
  db: {
    select: () => {
      mocks.selectCalls++
      const builder = {
        from: () => builder,
        innerJoin: () => builder,
        where: () => builder,
        limit: async () => mocks.rows,
      }
      return builder
    },
    update: () => ({
      set: (values: unknown) => {
        mocks.updateSets.push(values)
        return {
          where: async () => {
            mocks.updateCalls++
            if (mocks.updateThrows) throw new Error('db down')
          },
        }
      },
    }),
  },
}))

vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }))

import { requireAdminApi } from '../admin-api-auth'

const token = generateAdminApiToken().token

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://portal.test/api/admin/v1/products', { headers })
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: 'token-1',
    tokenPrefix: 'gantry_admin_abcd1234',
    tokenScopes: ['read'],
    expiresAt: new Date(Date.now() + 3600_000),
    revokedAt: null,
    userId: 'user-1',
    userStatus: 'active',
    userRole: 'portal-admin',
    userEmail: 'admin@example.com',
    ...overrides,
  }
}

async function body(response: Response) {
  return (await response.json()) as { error?: { code: string; message: string } }
}

beforeEach(() => {
  mocks.rows = []
  mocks.selectCalls = 0
  mocks.updateSets = []
  mocks.updateCalls = 0
  mocks.updateThrows = false
  mocks.rateLimit.mockResolvedValue(true)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('requireAdminApi', () => {
  it('rejects a missing Authorization header with 401', async () => {
    const result = await requireAdminApi(request(), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      expect(result.response.headers.get('www-authenticate')).toBe('Bearer')
      expect((await body(result.response)).error?.code).toBe('unauthorized')
    }
    expect(mocks.selectCalls).toBe(0)
  })

  it('rejects cookie-only auth (no NextAuth fallback)', async () => {
    const result = await requireAdminApi(
      request({ cookie: 'authjs.session-token=some-session' }),
      'read',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
    expect(mocks.selectCalls).toBe(0)
  })

  it('rejects non-Bearer schemes and malformed tokens with 401', async () => {
    for (const header of ['Basic abc', 'Bearer', 'Bearer short', `Bearer ${token}extra`]) {
      const result = await requireAdminApi(request({ authorization: header }), 'read')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    }
    expect(mocks.selectCalls).toBe(0)
  })

  it('rejects unknown tokens with 401', async () => {
    mocks.rows = []
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('rejects expired tokens with 401', async () => {
    mocks.rows = [row({ expiresAt: new Date(Date.now() - 1000) })]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('rejects revoked tokens with 401', async () => {
    mocks.rows = [row({ revokedAt: new Date() })]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('rejects suspended owners with 403', async () => {
    mocks.rows = [row({ userStatus: 'suspended' })]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it('rejects owners demoted below portal-admin with 403', async () => {
    mocks.rows = [row({ userRole: 'developer' })]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(403)
  })

  it('rejects a token missing the required scope with 403', async () => {
    mocks.rows = [row({ tokenScopes: ['read'] })]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'products:write')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      expect((await body(result.response)).error?.message).toContain('products:write')
    }
    expect(mocks.updateCalls).toBe(0)
  })

  it('returns the actor and records lastUsedAt on success', async () => {
    mocks.rows = [row()]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.actor).toEqual({
        userId: 'user-1',
        userEmail: 'admin@example.com',
        tokenId: 'token-1',
        tokenPrefix: 'gantry_admin_abcd1234',
        scopes: ['read'],
      })
    }
    expect(mocks.updateCalls).toBe(1)
    expect(mocks.updateSets[0]).toMatchObject({ lastUsedAt: expect.any(Date) })
  })

  it('accepts write scopes when they are present', async () => {
    mocks.rows = [row({ tokenScopes: ['read', 'products:write'] })]
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'products:write')
    expect(result.ok).toBe(true)
  })

  it('does not fail the request when updating lastUsedAt fails', async () => {
    mocks.rows = [row()]
    mocks.updateThrows = true
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(true)
  })

  it('returns 429 when the per-token rate limit is exceeded', async () => {
    mocks.rows = [row()]
    mocks.rateLimit.mockResolvedValueOnce(false)
    const result = await requireAdminApi(request({ authorization: `Bearer ${token}` }), 'read')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(429)
      expect(result.response.headers.get('retry-after')).toBe('60')
    }
    expect(mocks.updateCalls).toBe(0)
  })
})
