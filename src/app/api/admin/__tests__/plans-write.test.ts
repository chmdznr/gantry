import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAdminApiToken } from '@/lib/admin-api-tokens'

const mocks = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  projections: [] as Record<string, unknown>[],
  inserted: [] as Record<string, unknown>[],
  insertRows: [] as unknown[],
  insertError: null as unknown,
  insertCalls: 0,
  deleteRows: [] as unknown[],
  deleteCalls: 0,
  subscription: null as unknown,
  audits: [] as unknown[][],
  revalidated: [] as string[],
}))

vi.mock('@/db', () => ({
  db: {
    select: (projection: Record<string, unknown>) => {
      mocks.projections.push(projection)
      const result = mocks.selectQueue.shift() ?? []
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
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.insertCalls += 1
        mocks.inserted.push(values)
        return {
          returning: async () => {
            if (mocks.insertError) throw mocks.insertError
            return mocks.insertRows
          },
        }
      },
    }),
    delete: () => {
      mocks.deleteCalls += 1
      return { where: () => ({ returning: async () => mocks.deleteRows }) }
    },
    query: { subscriptions: { findFirst: async () => mocks.subscription } },
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  },
}))

vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => true }))

vi.mock('@/lib/audit', () => ({
  audit: async (...args: unknown[]) => {
    mocks.audits.push(args)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    mocks.revalidated.push(path)
  },
}))

import { POST as postPlan } from '@/app/api/admin/v1/plans/route'
import { DELETE as deletePlan, GET as getPlan } from '@/app/api/admin/v1/plans/[id]/route'

const token = generateAdminApiToken().token
const planId = '11111111-1111-4111-8111-111111111111'

const planRow = {
  id: planId,
  name: 'Gold',
  description: 'Tier',
  rateLimit: { minute: 60 },
  createdAt: '2026-01-01T00:00:00.000Z',
}

function authRow(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: 'token-1',
    tokenPrefix: 'gantry_admin_abcd1234',
    tokenScopes: ['plans:write'],
    expiresAt: new Date(Date.now() + 3600_000),
    revokedAt: null,
    userId: 'user-1',
    userStatus: 'active',
    userRole: 'portal-admin',
    userEmail: 'admin@example.com',
    ...overrides,
  }
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://portal.test/api/admin/v1/${path}`, init)
}

function postRequest(body: unknown): Request {
  return request('plans', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function authenticated(init: RequestInit = {}): Request {
  return request(`plans/${planId}`, { ...init, headers: { authorization: `Bearer ${token}` } })
}

function context() {
  return { params: Promise.resolve({ id: planId }) }
}

beforeEach(() => {
  mocks.selectQueue = []
  mocks.projections = []
  mocks.inserted = []
  mocks.insertRows = []
  mocks.insertError = null
  mocks.insertCalls = 0
  mocks.deleteRows = []
  mocks.deleteCalls = 0
  mocks.subscription = null
  mocks.audits = []
  mocks.revalidated = []
})

describe('admin API plans write routes', () => {
  it('POST /plans creates a plan, audits the token, and revalidates the UI', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.insertRows = [planRow]

    const response = await postPlan(postRequest({ name: ' Gold ', description: ' Tier ', rateLimit: { minute: 60 } }))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: planRow })
    expect(mocks.inserted).toEqual([{ name: 'Gold', description: 'Tier', rateLimit: { minute: 60 } }])
    expect(mocks.audits).toEqual([
      [
        'user-1',
        'plan.create',
        'plan',
        planId,
        {
          name: 'Gold',
          limits: { minute: 60 },
          tokenId: 'token-1',
          tokenPrefix: 'gantry_admin_abcd1234',
        },
      ],
    ])
    expect(mocks.revalidated).toEqual(['/admin/plans'])
  })

  it('POST /plans rejects invalid bodies and plans without a limit', async () => {
    mocks.selectQueue = [[authRow()], [authRow()], [authRow()], [authRow()]]

    const invalid = [
      { name: 'G', rateLimit: { minute: 60 } },
      { name: 'Gold', rateLimit: {} },
      { name: 'Gold', rateLimit: { minute: 0 } },
      { name: 'Gold' },
    ]
    for (const body of invalid) {
      const response = await postPlan(postRequest(body))
      expect(response.status).toBe(400)
      const json = (await response.json()) as { error: { code: string } }
      expect(json.error.code).toBe('validation_error')
    }
    expect(mocks.insertCalls).toBe(0)
  })

  it('POST /plans returns 409 for a duplicate plan name', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.insertError = Object.assign(new Error('duplicate key'), { code: '23505' })

    const response = await postPlan(postRequest({ name: 'Gold', rateLimit: { minute: 60 } }))

    expect(response.status).toBe(409)
    const json = (await response.json()) as { error: { code: string } }
    expect(json.error.code).toBe('conflict')
    expect(mocks.audits).toEqual([])
  })

  it('POST /plans requires the plans:write scope', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]

    const response = await postPlan(postRequest({ name: 'Gold', rateLimit: { minute: 60 } }))

    expect(response.status).toBe(403)
    expect(mocks.insertCalls).toBe(0)
  })

  it('GET /plans/[id] returns a plan', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], [planRow]]

    const response = await getPlan(authenticated(), context())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: planRow })
  })

  it('GET /plans/[id] returns 404 for an absent plan and requires read scope', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], [], [authRow({ tokenScopes: ['plans:write'] })]]

    const missing = await getPlan(authenticated(), context())
    expect(missing.status).toBe(404)

    const forbiddenRequest = request(`plans/${planId}`, { headers: { authorization: `Bearer ${token}` } })
    const forbidden = await getPlan(forbiddenRequest, context())
    expect(forbidden.status).toBe(403)
  })

  it('DELETE /plans/[id] returns 409 PLAN_IN_USE when a subscription uses the plan', async () => {
    mocks.selectQueue = [[authRow()], [{ id: planId }]]
    mocks.subscription = { id: 'sub-1', planId }

    const response = await deletePlan(authenticated({ method: 'DELETE' }), context())

    expect(response.status).toBe(409)
    const json = (await response.json()) as { error: { code: string; details: { code: string } } }
    expect(json.error.code).toBe('conflict')
    expect(json.error.details.code).toBe('PLAN_IN_USE')
    expect(mocks.deleteCalls).toBe(0)
    expect(mocks.audits).toEqual([])
  })

  it('DELETE /plans/[id] deletes an unused plan and audits the token', async () => {
    mocks.selectQueue = [[authRow()], [{ id: planId }]]
    mocks.deleteRows = [{ id: planId }]

    const response = await deletePlan(authenticated({ method: 'DELETE' }), context())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { id: planId, deleted: true } })
    expect(mocks.audits).toEqual([
      ['user-1', 'plan.delete', 'plan', planId, { tokenId: 'token-1', tokenPrefix: 'gantry_admin_abcd1234' }],
    ])
    expect(mocks.revalidated).toEqual(['/admin/plans'])
  })

  it('DELETE /plans/[id] returns 404 for an absent plan', async () => {
    mocks.selectQueue = [[authRow()], []]

    const response = await deletePlan(authenticated({ method: 'DELETE' }), context())

    expect(response.status).toBe(404)
    expect(mocks.deleteCalls).toBe(0)
  })

  it('DELETE /plans/[id] requires the plans:write scope', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]

    const response = await deletePlan(authenticated({ method: 'DELETE' }), context())

    expect(response.status).toBe(403)
    expect(mocks.deleteCalls).toBe(0)
  })
})
