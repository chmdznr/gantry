import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAdminApiToken } from '@/lib/admin-api-tokens'
import { apiProducts, apiProductSpecVersions, auditLogs } from '@/db/schema'

const mocks = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  findFirstQueue: [] as unknown[],
  updateReturnQueue: [] as unknown[][],
  insertReturnQueue: [] as unknown[][],
  insertErrors: [] as unknown[],
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
  updates: [] as { table: unknown; values: Record<string, unknown> }[],
  revalidatePath: vi.fn(),
}))

const kongMock = vi.hoisted(() => {
  class KongError extends Error {
    constructor(message: string, public status: number) {
      super(message)
    }
  }
  return { listServices: vi.fn(), KongError }
})

vi.mock('@/db', () => ({
  db: {
    select: () => {
      const result = mocks.selectQueue.shift() ?? []
      const builder = {
        from: () => builder,
        innerJoin: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: async () => result,
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      }
      return builder
    },
    query: {
      apiProducts: { findFirst: async () => mocks.findFirstQueue.shift() ?? null },
    },
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const error = mocks.insertErrors.shift()
        if (error) throw error
        mocks.inserts.push({ table, values })
        return { returning: async () => mocks.insertReturnQueue.shift() ?? [] }
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => {
        mocks.updates.push({ table, values })
        return {
          where: () => ({
            returning: async () => mocks.updateReturnQueue.shift() ?? [],
            then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve, reject),
          }),
        }
      },
    }),
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => true }))
vi.mock('@/lib/kong', () => ({ KongError: kongMock.KongError, listServices: kongMock.listServices }))

import { GET as listProducts, POST as createProduct } from '@/app/api/admin/v1/products/route'
import { GET as getProduct, PATCH as patchProduct } from '@/app/api/admin/v1/products/[id]/route'
import { PUT as putSpec } from '@/app/api/admin/v1/products/[id]/spec/route'
import { POST as postStatus } from '@/app/api/admin/v1/products/[id]/status/route'
import { GET as getVersions } from '@/app/api/admin/v1/products/[id]/versions/route'
import { POST as importProducts } from '@/app/api/admin/v1/products/import/route'
import { GET as getKongServices } from '@/app/api/admin/v1/kong/services/route'

const token = generateAdminApiToken().token

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://portal.test/api/admin/v1/${path}`, init)
}

function bearer(): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

function authRow(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: 'token-1',
    tokenPrefix: 'gantry_admin_abcd1234',
    tokenScopes: ['read', 'products:write'],
    expiresAt: new Date(Date.now() + 3600_000),
    revokedAt: null,
    userId: 'user-1',
    userStatus: 'active',
    userRole: 'portal-admin',
    userEmail: 'admin@example.com',
    ...overrides,
  }
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    slug: 'weather-api',
    name: 'Weather API',
    description: '',
    openapiSpec: null,
    version: '1.0.0',
    kongServiceNames: ['weather'],
    aclGroup: 'weather-api',
    proxyBaseUrl: 'https://gw.test/weather',
    status: 'draft',
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function inserted(table: unknown) {
  return mocks.inserts.find((entry) => entry.table === table)
}

beforeEach(() => {
  mocks.selectQueue = []
  mocks.findFirstQueue = []
  mocks.updateReturnQueue = []
  mocks.insertReturnQueue = []
  mocks.insertErrors = []
  mocks.inserts = []
  mocks.updates = []
  mocks.revalidatePath.mockReset()
  kongMock.listServices.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/admin/v1/products', () => {
  it('creates a draft product and snapshots the initial spec with its endpoint changelog', async () => {
    const created = productRow()
    mocks.selectQueue = [[authRow()]]
    mocks.insertReturnQueue = [[created]]

    const response = await createProduct(request('products', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        slug: ' Weather-API ',
        name: 'Weather API',
        proxyBaseUrl: 'https://gw.test/weather',
        kongServiceNames: ['weather'],
        status: 'draft',
        spec: {
          openapi: '3.0.0',
          info: { title: 'Weather', version: '1.0.0' },
          paths: { '/weather': { get: { summary: 'Current weather' } } },
        },
        changeNote: 'initial',
      }),
    }))

    expect(response.status).toBe(201)
    const json = (await response.json()) as { data: { id: string; slug: string } }
    expect(json.data).toMatchObject({ id: 'p-1', slug: 'weather-api' })

    expect(inserted(apiProducts)?.values).toMatchObject({
      slug: 'weather-api',
      name: 'Weather API',
      description: '',
      version: '1.0.0',
      aclGroup: 'weather-api',
      kongServiceNames: ['weather'],
      tags: [],
      status: 'draft',
    })
    expect(inserted(apiProducts)?.values.openapiSpec).toMatchObject({
      paths: { '/weather': { get: { summary: 'Current weather' } } },
    })

    expect(inserted(apiProductSpecVersions)?.values).toMatchObject({
      apiProductId: 'p-1',
      version: '1.0.0',
      note: 'initial',
      createdBy: 'user-1',
    })
    expect(inserted(apiProductSpecVersions)?.values.changelog).toEqual({
      added: ['GET /weather'],
      removed: [],
      changed: [],
    })

    expect(inserted(auditLogs)?.values).toMatchObject({
      action: 'product.create',
      entityType: 'api_product',
      entityId: 'p-1',
      payload: { slug: 'weather-api', tokenId: 'token-1', tokenPrefix: 'gantry_admin_abcd1234' },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/apis')
  })

  it('converts a Postman Collection v2 into OpenAPI before storing the initial spec', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.insertReturnQueue = [[productRow()]]

    const response = await createProduct(request('products', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        slug: 'weather-api',
        name: 'Weather API',
        proxyBaseUrl: 'https://gw.test/weather',
        kongServiceNames: ['weather'],
        spec: {
          info: { name: 'Weather', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
          item: [{ name: 'Current weather', request: { method: 'GET', url: { raw: 'https://gw.test/weather', path: ['weather'] } } }],
        },
      }),
    }))

    expect(response.status).toBe(201)
    const stored = inserted(apiProducts)?.values.openapiSpec as { openapi: string; paths: Record<string, unknown> }
    expect(stored.openapi).toBe('3.0.0')
    expect(Object.keys(stored.paths)).toEqual(['/weather'])
    expect(inserted(apiProductSpecVersions)?.values.changelog).toEqual({
      added: ['GET /weather'],
      removed: [],
      changed: [],
    })
  })

  it('rejects an invalid slug before touching the database', async () => {
    mocks.selectQueue = [[authRow()]]

    const response = await createProduct(request('products', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        slug: 'Bad Slug',
        name: 'Weather API',
        proxyBaseUrl: 'https://gw.test/weather',
        kongServiceNames: ['weather'],
      }),
    }))

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: { code: string; message: string } }
    expect(json.error.code).toBe('validation_error')
    expect(json.error.message).toContain('Slug wajib')
    expect(mocks.inserts).toHaveLength(0)
  })

  it('maps a duplicate slug to 409 without writing a snapshot or audit entry', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.insertErrors = [{ code: '23505' }]

    const response = await createProduct(request('products', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        slug: 'weather-api',
        name: 'Weather API',
        proxyBaseUrl: 'https://gw.test/weather',
        kongServiceNames: ['weather'],
        spec: { openapi: '3.0.0', paths: {} },
      }),
    }))

    expect(response.status).toBe(409)
    const json = (await response.json()) as { error: { code: string; message: string } }
    expect(json.error.code).toBe('conflict')
    expect(json.error.message).toBe('Slug sudah dipakai.')
    expect(mocks.inserts).toHaveLength(0)
  })

  it('rejects a read-only token with 403 before any write', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]

    const response = await createProduct(request('products', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        slug: 'weather-api',
        name: 'Weather API',
        proxyBaseUrl: 'https://gw.test/weather',
        kongServiceNames: ['weather'],
      }),
    }))

    expect(response.status).toBe(403)
    expect(mocks.inserts).toHaveLength(0)
  })
})

describe('GET /api/admin/v1/products/[id]', () => {
  it('returns 404 for an absent product', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]
    mocks.findFirstQueue = [null]

    const response = await getProduct(request('products/missing', { headers: bearer() }), context('missing'))
    expect(response.status).toBe(404)
  })

  it('PATCH merges partial fields with the current row', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.findFirstQueue = [productRow({ description: 'Old', tags: ['internal'], aclGroup: 'weather' })]
    mocks.updateReturnQueue = [[productRow({ description: 'New', tags: ['internal'], aclGroup: 'weather' })]]

    const response = await patchProduct(request('products/p-1', {
      method: 'PATCH',
      headers: bearer(),
      body: JSON.stringify({ description: 'New' }),
    }), context('p-1'))

    expect(response.status).toBe(200)
    expect(mocks.updates.find((entry) => entry.table === apiProducts)?.values).toMatchObject({
      slug: 'weather-api',
      name: 'Weather API',
      description: 'New',
      version: '1.0.0',
      aclGroup: 'weather',
      kongServiceNames: ['weather'],
      tags: ['internal'],
    })
    expect(inserted(auditLogs)?.values).toMatchObject({
      action: 'product.update',
      payload: { slug: 'weather-api', tokenId: 'token-1' },
    })
  })
})

describe('GET /api/admin/v1/products/[id]/versions', () => {
  it('lists spec versions without leaking spec bodies', async () => {
    const versions = [{ id: 'sv-1', version: '1.0.0', changelog: { added: ['GET /weather'], removed: [], changed: [] }, note: null, createdBy: 'user-1', createdAt: new Date() }]
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], versions]
    mocks.findFirstQueue = [{ id: 'p-1' }]

    const response = await getVersions(request('products/p-1/versions', { headers: bearer() }), context('p-1'))
    expect(response.status).toBe(200)
    const json = (await response.json()) as { data: { id: string; spec?: unknown }[] }
    expect(json.data).toHaveLength(1)
    expect(json.data[0]).toMatchObject({ id: 'sv-1', version: '1.0.0', createdBy: 'user-1' })
    expect(json.data[0]?.spec).toBeUndefined()
  })
})

describe('POST /api/admin/v1/products/[id]/status', () => {
  it('publishes a product, audits the actor token, and revalidates the public catalog', async () => {
    const published = productRow({ status: 'published' })
    mocks.selectQueue = [[authRow()]]
    mocks.updateReturnQueue = [[published]]

    const response = await postStatus(request('products/p-1/status', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({ status: 'published' }),
    }), context('p-1'))

    expect(response.status).toBe(200)
    const json = (await response.json()) as { data: { status: string } }
    expect(json.data.status).toBe('published')

    const update = mocks.updates.find((entry) => entry.table === apiProducts)
    expect(update?.values).toMatchObject({ status: 'published' })
    expect(update?.values.updatedAt).toBeInstanceOf(Date)

    expect(inserted(auditLogs)?.values).toMatchObject({
      action: 'product.published',
      entityId: 'p-1',
      payload: { tokenId: 'token-1', tokenPrefix: 'gantry_admin_abcd1234' },
    })
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(['/admin/apis', '/admin/apis/p-1', '/']),
    )
  })

  it('returns 404 when the status update matches no row', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.updateReturnQueue = [[]]

    const response = await postStatus(request('products/missing/status', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({ status: 'retired' }),
    }), context('missing'))

    expect(response.status).toBe(404)
    expect(mocks.inserts).toHaveLength(0)
  })
})

describe('PUT /api/admin/v1/products/[id]/spec', () => {
  const priorSpec = {
    openapi: '3.0.0',
    paths: {
      '/legacy': { get: { summary: 'Old' } },
      '/weather': { get: { summary: 'Old weather' } },
    },
  }

  it('writes a spec version with added/removed/changed endpoints', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.findFirstQueue = [productRow({ version: '1.2.0', openapiSpec: priorSpec })]
    mocks.updateReturnQueue = [[productRow({ version: '1.2.0' })]]
    mocks.insertReturnQueue = [[{
      id: 'sv-2',
      apiProductId: 'p-1',
      version: '1.2.0',
      changelog: null,
      note: 'orders',
      createdBy: 'user-1',
      createdAt: new Date(),
    }]]

    const response = await putSpec(request('products/p-1/spec', {
      method: 'PUT',
      headers: bearer(),
      body: JSON.stringify({
        spec: {
          openapi: '3.0.0',
          paths: {
            '/weather': { get: { summary: 'New weather' } },
            '/orders': { post: { summary: 'Create order' } },
          },
        },
        changeNote: 'orders',
      }),
    }), context('p-1'))

    expect(response.status).toBe(200)
    const json = (await response.json()) as { data: { specVersion: { id: string } } }
    expect(json.data.specVersion.id).toBe('sv-2')

    expect(inserted(apiProductSpecVersions)?.values).toMatchObject({
      apiProductId: 'p-1',
      version: '1.2.0',
      note: 'orders',
      createdBy: 'user-1',
    })
    expect(inserted(apiProductSpecVersions)?.values.changelog).toEqual({
      added: ['POST /orders'],
      removed: ['GET /legacy'],
      changed: ['GET /weather'],
    })
    expect(inserted(auditLogs)?.values).toMatchObject({
      action: 'product.spec-edit',
      payload: { slug: 'weather-api', tokenId: 'token-1' },
    })
  })

  it('does not snapshot or update when the spec is unchanged', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.findFirstQueue = [productRow({ openapiSpec: priorSpec })]

    const response = await putSpec(request('products/p-1/spec', {
      method: 'PUT',
      headers: bearer(),
      body: JSON.stringify({ spec: priorSpec }),
    }), context('p-1'))

    expect(response.status).toBe(200)
    const json = (await response.json()) as { data: { specVersion: null } }
    expect(json.data.specVersion).toBeNull()
    expect(mocks.updates.some((entry) => entry.table === apiProducts)).toBe(false)
    expect(mocks.inserts).toHaveLength(0)
  })
})

describe('POST /api/admin/v1/products/import', () => {
  it('reports imported, skippedExisting, and error per service', async () => {
    mocks.selectQueue = [
      [authRow()],
      [{ kongServiceNames: ['weather'] }],
    ]
    mocks.insertReturnQueue = [[{ id: 'p-orders' }]]

    const response = await importProducts(request('products/import', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({ services: ['weather', 'orders', '!!'] }),
    }))

    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      data: { results: { service: string; status: string; slug?: string; productId?: string }[] }
    }
    expect(json.data.results).toEqual([
      { service: 'weather', status: 'skippedExisting', slug: 'weather' },
      { service: 'orders', status: 'imported', slug: 'orders', productId: 'p-orders' },
      { service: '!!', status: 'error', error: 'Service name cannot be converted to a valid slug.' },
    ])

    const productInserts = mocks.inserts.filter((entry) => entry.table === apiProducts)
    expect(productInserts).toHaveLength(1)
    expect(productInserts[0]?.values).toMatchObject({
      slug: 'orders',
      name: 'orders',
      aclGroup: 'orders',
      kongServiceNames: ['orders'],
    })
    expect(inserted(auditLogs)?.values).toMatchObject({
      action: 'product.import',
      entityId: 'p-orders',
      payload: { service: 'orders', tokenId: 'token-1' },
    })
  })

  it('treats a slug unique violation as skippedExisting', async () => {
    mocks.selectQueue = [[authRow()], []]
    mocks.insertErrors = [{ code: '23505' }]

    const response = await importProducts(request('products/import', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({ services: ['orders'] }),
    }))

    expect(response.status).toBe(200)
    const json = (await response.json()) as { data: { results: { status: string }[] } }
    expect(json.data.results).toEqual([{ service: 'orders', status: 'skippedExisting', slug: 'orders' }])
  })
})

describe('GET /api/admin/v1/kong/services', () => {
  it('lists Kong services with catalog mapping so import candidates are obvious', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], [
      { id: 'p-1', slug: 'weather-api', kongServiceNames: ['weather'] },
    ]]
    kongMock.listServices.mockResolvedValue([
      { name: 'weather', host: 'weather.internal' },
      { name: 'orders', host: 'orders.internal' },
    ])

    const response = await getKongServices(request('kong/services', { headers: bearer() }))
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      data: { services: { name: string; imported: boolean; products: { id: string }[] }[] }
    }
    expect(json.data.services).toEqual([
      { name: 'weather', host: 'weather.internal', imported: true, products: [{ id: 'p-1', slug: 'weather-api' }] },
      { name: 'orders', host: 'orders.internal', imported: false, products: [] },
    ])
  })

  it('returns a safe structured 502 when Kong fails', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]
    kongMock.listServices.mockRejectedValue(new kongMock.KongError('Kong GET /services -> 500', 500))

    const response = await getKongServices(request('kong/services', { headers: bearer() }))
    expect(response.status).toBe(502)
    const json = (await response.json()) as { error: { code: string; details: unknown } }
    expect(json.error.code).toBe('internal_error')
    expect(json.error.details).toEqual({ upstream: 'kong', status: 500 })
  })
})

describe('GET /api/admin/v1/products', () => {
  it('keeps the existing read behavior and does not require a write scope', async () => {
    const rows = [{ id: 'p-1', slug: 'weather-api' }]
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], rows]

    const response = await listProducts(request('products', { headers: bearer() }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: rows })
  })
})
