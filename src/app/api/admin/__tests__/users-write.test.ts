import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAdminApiToken } from '@/lib/admin-api-tokens'
import { passwordResetTokens } from '@/db/schema'

const mocks = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  projections: [] as Record<string, unknown>[],
  insertRows: [] as unknown[],
  inserted: [] as Record<string, unknown>[],
  updateResults: [] as unknown[],
  updates: [] as Record<string, unknown>[],
  deletes: [] as { table: unknown; condition: unknown }[],
  audits: [] as unknown[][],
  mails: [] as string[][],
  revalidated: [] as string[],
  mailFails: false,
  consoleLogs: [] as unknown[][],
  consoleErrors: [] as unknown[][],
}))

vi.mock('@/db', () => {
  function selectBuilder() {
    const builder = {
      from: () => builder,
      innerJoin: () => builder,
      where: () => builder,
      orderBy: () => builder,
      limit: async () => mocks.selectQueue.shift() ?? [],
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(mocks.selectQueue.shift() ?? []).then(resolve, reject),
    }
    return builder
  }

  return {
    db: {
      select: (projection: Record<string, unknown>) => {
        mocks.projections.push(projection)
        return selectBuilder()
      },
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          mocks.inserted.push(values)
          return {
            returning: async () => {
              const result = mocks.insertRows.shift() ?? []
              if (result instanceof Error) throw result
              return result
            },
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve, reject),
          }
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          mocks.updates.push(values)
          // last_used_at best-effort tidak memakai queue hasil update user
          const isUserUpdate = !('lastUsedAt' in values)
          return {
            where: () => {
              const outcome = () => {
                const result = isUserUpdate ? (mocks.updateResults.shift() ?? []) : []
                if (result instanceof Error) throw result
                return result
              }
              return {
                returning: async () => outcome(),
                then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
                  Promise.resolve(outcome()).then(resolve, reject),
              }
            },
          }
        },
      }),
      delete: (table: unknown) => ({
        where: async (condition: unknown) => {
          mocks.deletes.push({ table, condition })
        },
      }),
    },
  }
})

vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => true }))

vi.mock('@/lib/audit', () => ({
  audit: async (...args: unknown[]) => {
    mocks.audits.push(args)
  },
}))

vi.mock('@/lib/mailer', () => ({
  sendInviteEmail: async (to: string, link: string) => {
    mocks.mails.push([to, link])
    if (mocks.mailFails) throw new Error('smtp unavailable')
  },
}))

vi.mock('@/lib/password', () => ({ hashPassword: async (pw: string) => `hashed:${pw}` }))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => {
    mocks.revalidated.push(path)
  },
}))

import { POST as postUser } from '@/app/api/admin/v1/users/route'
import { GET as getUser } from '@/app/api/admin/v1/users/[id]/route'
import { POST as postUserAction } from '@/app/api/admin/v1/users/[id]/[action]/route'

const token = generateAdminApiToken().token
const userId = '11111111-1111-4111-8111-111111111111'

const userRow = {
  id: userId,
  email: 'new@example.com',
  name: 'New User',
  organization: 'ORG',
  type: 'internal',
  status: 'active',
  role: 'developer',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function authRow(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: 'token-1',
    tokenPrefix: 'gantry_admin_abcd1234',
    tokenScopes: ['users:write'],
    expiresAt: new Date(Date.now() + 3600_000),
    revokedAt: null,
    userId: 'admin-1',
    userStatus: 'active',
    userRole: 'portal-admin',
    userEmail: 'admin@example.com',
    ...overrides,
  }
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`http://portal.test/api/admin/v1/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
  })
}

function jsonRequest(path: string, body: unknown): Request {
  return request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function userContext() {
  return { params: Promise.resolve({ id: userId }) }
}

function actionContext(action: string) {
  return { params: Promise.resolve({ id: userId, action }) }
}

function userUpdates() {
  return mocks.updates.filter((values) => !('lastUsedAt' in values))
}

beforeEach(() => {
  mocks.selectQueue = []
  mocks.projections = []
  mocks.insertRows = []
  mocks.inserted = []
  mocks.updateResults = []
  mocks.updates = []
  mocks.deletes = []
  mocks.audits = []
  mocks.mails = []
  mocks.revalidated = []
  mocks.mailFails = false
  mocks.consoleLogs = []
  mocks.consoleErrors = []
  vi.stubEnv('PORTAL_BASE_URL', 'https://portal.test')
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    mocks.consoleLogs.push(args)
  })
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    mocks.consoleErrors.push(args)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('admin API users read/write routes', () => {
  it('GET /users/[id] returns safe user fields only', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], [userRow]]

    const response = await getUser(request(`users/${userId}`), userContext())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: userRow })
    const selected = Object.keys(mocks.projections[1])
    expect(selected).not.toContain('passwordHash')
    expect(selected).not.toContain('sessionVersion')
    expect(selected).not.toContain('tokenHash')
  })

  it('GET /users/[id] returns 404 for absent or malformed ids', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })], []]
    const missing = await getUser(request(`users/${userId}`), userContext())
    expect(missing.status).toBe(404)

    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]
    const malformed = await getUser(request('users/not-a-uuid'), userContext())
    expect(malformed.status).toBe(404)
  })

  it('POST /users creates an active+verified user, returns a 72h invite, and audits no secret', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.insertRows = [[userRow]]

    const response = await postUser(
      jsonRequest('users', {
        name: '  New User ',
        email: ' New@Example.com ',
        organization: ' ORG ',
        type: 'internal',
      }),
    )

    expect(response.status).toBe(201)
    const json = (await response.json()) as {
      data: { user: typeof userRow; inviteLink: string; inviteExpiresAt: string }
    }
    expect(json.data.user).toEqual(userRow)
    expect(json.data.inviteLink).toMatch(/^https:\/\/portal\.test\/auth\/reset\?token=[0-9a-f]{64}$/)
    const inviteToken = json.data.inviteLink.split('token=')[1]
    const ttl = Date.parse(json.data.inviteExpiresAt) - Date.now()
    expect(ttl).toBeGreaterThan(71 * 3600_000)
    expect(ttl).toBeLessThanOrEqual(72 * 3600_000)

    const [userValues, resetValues] = mocks.inserted
    expect(userValues).toMatchObject({
      email: 'new@example.com',
      name: 'New User',
      organization: 'ORG',
      type: 'internal',
      status: 'active',
    })
    expect(userValues.emailVerifiedAt).toBeInstanceOf(Date)
    expect(String(userValues.passwordHash)).not.toBe(inviteToken)
    expect(resetValues).toMatchObject({ token: inviteToken, userId })
    expect((resetValues.expiresAt as Date).getTime()).toBe(Date.parse(json.data.inviteExpiresAt))

    expect(mocks.audits).toEqual([
      [
        'admin-1',
        'user.create',
        'user',
        userId,
        {
          email: 'new@example.com',
          type: 'internal',
          createdBy: 'admin-api',
          tokenId: 'token-1',
          tokenPrefix: 'gantry_admin_abcd1234',
        },
      ],
    ])
    expect(JSON.stringify(mocks.audits)).not.toContain(inviteToken)
    expect(JSON.stringify(mocks.audits)).not.toContain(json.data.inviteLink)
    expect(mocks.mails).toEqual([['new@example.com', json.data.inviteLink]])
    expect(mocks.revalidated).toEqual(['/admin/users'])

    const responseText = JSON.stringify(json)
    expect(responseText).not.toContain('passwordHash')
    expect(responseText).not.toContain('sessionVersion')
    expect(mocks.consoleLogs).toEqual([])
    expect(mocks.consoleErrors).toEqual([])
  })

  it('POST /users rejects invalid bodies without inserting', async () => {
    mocks.selectQueue = [[authRow()], [authRow()], [authRow()], [authRow()]]

    const bodies = [
      { name: 'ab', email: 'a@b.co' },
      { name: 'Valid Name', email: 'not-an-email' },
      { name: 'Valid Name', email: 'a@b.co', type: 'other' },
      { email: 'a@b.co' },
    ]
    for (const body of bodies) {
      const response = await postUser(jsonRequest('users', body))
      expect(response.status).toBe(400)
      const json = (await response.json()) as { error: { code: string } }
      expect(json.error.code).toBe('validation_error')
    }
    expect(mocks.inserted).toEqual([])
    expect(mocks.audits).toEqual([])
  })

  it('POST /users returns 409 for a duplicate email', async () => {
    mocks.selectQueue = [[authRow()]]
    mocks.insertRows = [Object.assign(new Error('duplicate key'), { code: '23505' })]

    const response = await postUser(
      jsonRequest('users', { name: 'New User', email: 'NEW@example.com' }),
    )

    expect(response.status).toBe(409)
    const json = (await response.json()) as { error: { code: string; message: string } }
    expect(json.error.code).toBe('conflict')
    expect(json.error.message).toBe('new@example.com is already registered.')
    expect(mocks.inserted).toHaveLength(1)
    expect(mocks.audits).toEqual([])
    expect(mocks.mails).toEqual([])
  })

  it('POST /users still succeeds when invite mail fails, without logging the token', async () => {
    mocks.mailFails = true
    mocks.selectQueue = [[authRow()]]
    mocks.insertRows = [[userRow]]

    const response = await postUser(
      jsonRequest('users', { name: 'New User', email: 'new@example.com' }),
    )

    expect(response.status).toBe(201)
    const json = (await response.json()) as { data: { inviteLink: string } }
    const inviteToken = json.data.inviteLink.split('token=')[1]
    expect(mocks.audits).toHaveLength(1)
    expect(mocks.consoleErrors).toHaveLength(1)
    expect(JSON.stringify(mocks.consoleErrors)).not.toContain(inviteToken)
    expect(JSON.stringify(mocks.consoleErrors)).not.toContain(json.data.inviteLink)
  })

  it('POST /users requires the users:write scope', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['read'] })]]

    const response = await postUser(
      jsonRequest('users', { name: 'New User', email: 'new@example.com' }),
    )

    expect(response.status).toBe(403)
    expect(mocks.inserted).toEqual([])
  })

  it('POST /users/[id]/approve marks verified and audits the transition', async () => {
    mocks.selectQueue = [
      [authRow()],
      [{ ...userRow, status: 'pending', emailVerifiedAt: null }],
    ]
    mocks.updateResults = [[{ ...userRow, status: 'active' }]]

    const response = await postUserAction(request(`users/${userId}/approve`, { method: 'POST' }), actionContext('approve'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { ...userRow, status: 'active' } })
    expect(mocks.audits).toEqual([
      [
        'admin-1',
        'user.approve',
        'user',
        userId,
        { newStatus: 'active', tokenId: 'token-1', tokenPrefix: 'gantry_admin_abcd1234' },
      ],
    ])
    expect(mocks.revalidated).toEqual(['/admin/users'])
  })

  it.each([
    ['suspend', 'active', 'suspended', 'user.suspend'],
    ['activate', 'suspended', 'active', 'user.activate'],
  ])('POST /users/[id]/%s transitions and audits', async (action, from, to, auditAction) => {
    mocks.selectQueue = [[authRow()], [{ ...userRow, status: from }]]
    mocks.updateResults = [[{ ...userRow, status: to }]]

    const response = await postUserAction(
      request(`users/${userId}/${action}`, { method: 'POST' }),
      actionContext(action),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { ...userRow, status: to } })
    expect(userUpdates()).toEqual([{ status: to }])
    expect(mocks.audits).toEqual([
      [
        'admin-1',
        auditAction,
        'user',
        userId,
        { newStatus: to, tokenId: 'token-1', tokenPrefix: 'gantry_admin_abcd1234' },
      ],
    ])
  })

  it('POST /users/[id]/suspend is a no-op without auditing when already suspended', async () => {
    mocks.selectQueue = [[authRow()], [{ ...userRow, status: 'suspended' }]]

    const response = await postUserAction(request(`users/${userId}/suspend`, { method: 'POST' }), actionContext('suspend'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { ...userRow, status: 'suspended' } })
    expect(userUpdates()).toEqual([])
    expect(mocks.audits).toEqual([])
  })

  it('POST /users/[id]/approve returns 404 for an absent user', async () => {
    mocks.selectQueue = [[authRow()], []]

    const response = await postUserAction(request(`users/${userId}/approve`, { method: 'POST' }), actionContext('approve'))

    expect(response.status).toBe(404)
    expect(mocks.audits).toEqual([])
  })

  it('POST /users/[id]/password requires users:password, not users:write', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['users:write'] })]]

    const response = await postUserAction(
      jsonRequest(`users/${userId}/password`, { password: 'long-enough' }),
      actionContext('password'),
    )

    expect(response.status).toBe(403)
    expect(userUpdates()).toEqual([])
    expect(mocks.deletes).toEqual([])
    expect(mocks.audits).toEqual([])
  })

  it('POST /users/[id]/password sets the password, invalidates reset tokens, and audits no secret', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['users:password'] })], [userRow]]
    mocks.updateResults = [[userRow]]

    const response = await postUserAction(
      jsonRequest(`users/${userId}/password`, { password: 's3cret-pass' }),
      actionContext('password'),
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { data: typeof userRow }
    expect(json).toEqual({ data: userRow })
    expect(userUpdates()).toEqual([{ passwordHash: 'hashed:s3cret-pass' }])
    expect(mocks.deletes).toHaveLength(1)
    expect(mocks.deletes[0].table).toBe(passwordResetTokens)
    expect(mocks.audits).toEqual([
      ['admin-1', 'user.set_password', 'user', userId, { tokenId: 'token-1', tokenPrefix: 'gantry_admin_abcd1234' }],
    ])
    expect(JSON.stringify(mocks.audits)).not.toContain('s3cret-pass')
    expect(JSON.stringify(mocks.audits)).not.toContain('hashed:')
    expect(JSON.stringify(json)).not.toContain('passwordHash')
    expect(mocks.consoleLogs).toEqual([])
    expect(mocks.consoleErrors).toEqual([])
  })

  it('POST /users/[id]/password rejects passwords outside 8..128 characters', async () => {
    mocks.selectQueue = [
      [authRow({ tokenScopes: ['users:password'] })],
      [authRow({ tokenScopes: ['users:password'] })],
    ]

    for (const password of ['short', 'x'.repeat(129)]) {
      const response = await postUserAction(
        jsonRequest(`users/${userId}/password`, { password }),
        actionContext('password'),
      )
      expect(response.status).toBe(400)
      const json = (await response.json()) as {
        error: { code: string; details: { issues: { message: string }[] } }
      }
      expect(json.error.code).toBe('validation_error')
      expect(json.error.details.issues[0].message).toBe('Password must be 8–128 characters.')
    }
    expect(userUpdates()).toEqual([])
    expect(mocks.deletes).toEqual([])
    expect(mocks.audits).toEqual([])
  })

  it('POST /users/[id]/password returns 404 for an absent user', async () => {
    mocks.selectQueue = [[authRow({ tokenScopes: ['users:password'] })], []]

    const response = await postUserAction(
      jsonRequest(`users/${userId}/password`, { password: 'long-enough' }),
      actionContext('password'),
    )

    expect(response.status).toBe(404)
    expect(userUpdates()).toEqual([])
    expect(mocks.deletes).toEqual([])
    expect(mocks.audits).toEqual([])
  })
})
