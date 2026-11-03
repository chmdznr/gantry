import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAdminApiToken } from '@/lib/admin-api-tokens'

const mocks = vi.hoisted(() => ({
  queue: [] as unknown[][],
  projections: [] as Record<string, unknown>[],
}))

vi.mock('@/db', () => ({
  db: {
    select: (projection: Record<string, unknown>) => {
      mocks.projections.push(projection)
      const result = mocks.queue.shift() ?? []
      const builder = {
        from: () => builder,
        innerJoin: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: async () => result,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      }
      return builder
    },
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
  },
}))

vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => true }))

import { GET as getProducts } from '@/app/api/admin/v1/products/route'
import { GET as getPlans } from '@/app/api/admin/v1/plans/route'
import { GET as getUsers } from '@/app/api/admin/v1/users/route'
import { GET as getSetup } from '@/app/api/admin/v1/setup/route'
import { GET as getOpenApi } from '@/app/api/admin/v1/openapi.json/route'

const token = generateAdminApiToken().token

function request(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://portal.test/api/admin/v1/${path}`, { headers })
}

function bearer(): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

function authRow(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  mocks.queue = []
  mocks.projections = []
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('admin API read routes', () => {
  it('GET /products returns the product list', async () => {
    const products = [{ id: 'p-1', slug: 'weather', name: 'Weather', status: 'published' }]
    mocks.queue = [[authRow()], products]
    const response = await getProducts(request('products', bearer()))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: products })
    expect(Object.keys(mocks.projections[1])).toContain('slug')
    expect(Object.keys(mocks.projections[1])).not.toContain('openapiSpec')
  })

  it('GET /plans returns the plan list', async () => {
    const plans = [{ id: 'pl-1', name: 'Gold', rateLimit: { minute: 60 } }]
    mocks.queue = [[authRow()], plans]
    const response = await getPlans(request('plans', bearer()))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: plans })
  })

  it('GET /users never selects password hashes, session versions, or tokens', async () => {
    const users = [{ id: 'u-1', email: 'dev@example.com', name: 'Dev' }]
    mocks.queue = [[authRow()], users]
    const response = await getUsers(request('users', bearer()))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: users })
    const selected = Object.keys(mocks.projections[1])
    expect(selected).not.toContain('passwordHash')
    expect(selected).not.toContain('sessionVersion')
    expect(selected).not.toContain('tokenHash')
  })

  it('GET /setup exposes presence flags, never secret values', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:super-secret@db/portal')
    vi.stubEnv('SMTP_HOST', 'mail.internal')
    mocks.queue = [[authRow()]]
    const response = await getSetup(request('setup', bearer()))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toContain('super-secret')
    const json = JSON.parse(text) as { data: { api: string; integrations: Record<string, unknown> } }
    expect(json.data.api).toBe('gantry-admin-api')
    expect(json.data.integrations.database).toBe(true)
    expect(json.data.integrations.smtp).toBe(true)
    expect(typeof json.data.integrations.redis).toBe('boolean')
  })

  it('GET /openapi.json documents the foundation endpoints', async () => {
    mocks.queue = [[authRow()]]
    const response = await getOpenApi(request('openapi.json', bearer()))
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      data: { openapi: string; paths: Record<string, unknown> }
    }
    expect(json.data.openapi).toBe('3.1.0')
    expect(Object.keys(json.data.paths)).toEqual(
      expect.arrayContaining(['/setup', '/products', '/plans', '/users']),
    )
  })

  it('rejects missing bearer auth before querying data', async () => {
    const response = await getProducts(request('products'))
    expect(response.status).toBe(401)
    expect(mocks.projections).toHaveLength(0)
    const json = (await response.json()) as { error: { code: string } }
    expect(json.error.code).toBe('unauthorized')
  })

  it('rejects a token without the read scope with 403', async () => {
    mocks.queue = [[authRow({ tokenScopes: ['products:write'] })]]
    const response = await getUsers(request('users', bearer()))
    expect(response.status).toBe(403)
    // Only the auth lookup ran; no user query was issued.
    expect(mocks.projections).toHaveLength(1)
  })
})
