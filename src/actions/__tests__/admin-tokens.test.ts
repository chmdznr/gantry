import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  audit: vi.fn(),
  revalidatePath: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  updateSet: vi.fn(),
  updateReturning: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    insert: () => ({
      values: (values: unknown) => {
        mocks.insertValues(values)
        return { returning: mocks.insertReturning }
      },
    }),
    update: () => ({
      set: (values: unknown) => {
        mocks.updateSet(values)
        return { where: () => ({ returning: mocks.updateReturning }) }
      },
    }),
  },
}))

vi.mock('@/lib/require-admin', () => ({ requireAdmin: mocks.requireAdmin }))
vi.mock('@/lib/audit', () => ({ audit: mocks.audit }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

import { createAdminToken, revokeAdminToken } from '@/actions/admin-tokens'

function createForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData()
  form.set('name', overrides.name ?? 'CI agent')
  form.set('expiresInDays', overrides.expiresInDays ?? '30')
  const scopes = overrides.scopes ?? 'read,products:write'
  for (const scope of scopes.split(',').filter(Boolean)) form.append('scopes', scope)
  return form
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  mocks.insertReturning.mockResolvedValue([{ id: 'token-1' }])
  mocks.updateReturning.mockResolvedValue([{ id: 'token-1', name: 'CI agent' }])
})

describe('createAdminToken', () => {
  it('stores only the hash and prefix, and returns the plain token once', async () => {
    const before = Date.now()
    const result = await createAdminToken({}, createForm())

    expect(result.error).toBeUndefined()
    expect(result.token).toMatch(/^gantry_admin_[A-Za-z0-9_-]{43}$/)
    expect(result.ok).toContain('CI agent')

    const values = mocks.insertValues.mock.calls[0][0] as {
      userId: string
      name: string
      tokenHash: string
      tokenPrefix: string
      scopes: string[]
      expiresAt: Date
    }
    expect(values.userId).toBe('admin-1')
    expect(values.name).toBe('CI agent')
    expect(values.scopes).toEqual(['read', 'products:write'])
    expect(values.tokenHash).toBe(createHash('sha256').update(result.token!).digest('hex'))
    expect(JSON.stringify(values)).not.toContain(result.token!)
    expect(result.token!.startsWith(values.tokenPrefix)).toBe(true)
    const thirtyDays = 30 * 24 * 3600_000
    expect(values.expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDays)
    expect(values.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + thirtyDays)

    expect(mocks.audit).toHaveBeenCalledWith(
      'admin-1',
      'admin_api_token.create',
      'admin_api_token',
      'token-1',
      expect.objectContaining({ name: 'CI agent', scopes: ['read', 'products:write'] }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/tokens')
  })

  it('rejects invalid input before touching the database', async () => {
    const cases: Record<string, string>[] = [
      { name: '  ' },
      { scopes: '' },
      { scopes: 'read,root' },
      { expiresInDays: '365' },
    ]
    for (const overrides of cases) {
      const result = await createAdminToken({}, createForm(overrides))
      expect(result.error).toBeTruthy()
    }
    expect(mocks.insertValues).not.toHaveBeenCalled()
  })

  it('reports a token hash collision instead of throwing', async () => {
    mocks.insertReturning.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
    const result = await createAdminToken({}, createForm())
    expect(result.error).toContain('collision')
    expect(result.token).toBeUndefined()
  })
})

describe('revokeAdminToken', () => {
  it('sets revokedAt and audits the owning admin', async () => {
    await revokeAdminToken('token-1')
    expect(mocks.updateSet).toHaveBeenCalledWith({ revokedAt: expect.any(Date) })
    expect(mocks.audit).toHaveBeenCalledWith(
      'admin-1',
      'admin_api_token.revoke',
      'admin_api_token',
      'token-1',
      { name: 'CI agent' },
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/tokens')
  })

  it('does not audit a token that was already revoked or missing', async () => {
    mocks.updateReturning.mockResolvedValue([])
    await revokeAdminToken('token-1')
    expect(mocks.audit).not.toHaveBeenCalled()
  })
})
