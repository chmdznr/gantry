import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
  delete: vi.fn(),
  deleteWhere: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  rateLimit: vi.fn(),
  clientIp: vi.fn(),
  audit: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/require-admin', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/db', () => ({
  db: {
    query: { users: { findFirst: mocks.findFirst } },
    transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/password', () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit, clientIp: mocks.clientIp }))
vi.mock('@/lib/audit', () => ({ audit: mocks.audit }))
vi.mock('@/auth', () => ({ signOut: mocks.signOut }))
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn(async () => (key: string) => key) }))

const { changePassword } = await import('../change-password')

function form(currentPassword = 'old-password', newPassword = 'new-password', confirmPassword = newPassword) {
  const data = new FormData()
  data.set('currentPassword', currentPassword)
  data.set('newPassword', newPassword)
  data.set('confirmPassword', confirmPassword)
  return data
}

describe('changePassword', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireUser.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.clientIp.mockResolvedValue('127.0.0.1')
    mocks.rateLimit.mockResolvedValue(true)
    mocks.findFirst.mockResolvedValue({ passwordHash: 'old-hash' })
    mocks.verifyPassword.mockResolvedValue(true)
    mocks.hashPassword.mockResolvedValue('new-hash')
    mocks.update.mockReturnValue({ set: mocks.set })
    mocks.set.mockReturnValue({ where: mocks.where })
    mocks.where.mockReturnValue({ returning: mocks.returning })
    mocks.returning.mockResolvedValue([{ id: 'user-1' }])
    mocks.delete.mockReturnValue({ where: mocks.deleteWhere })
    mocks.deleteWhere.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation(async (run) => run({ update: mocks.update, delete: mocks.delete }))
  })

  it('rejects a wrong current password without updating the user', async () => {
    mocks.verifyPassword.mockResolvedValue(false)

    await expect(changePassword({}, form())).resolves.toEqual({ error: 'currentPasswordInvalid' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('rejects a mismatched password confirmation', async () => {
    await expect(changePassword({}, form('old-password', 'new-password', 'different-password')))
      .resolves.toEqual({ error: 'passwordMismatch' })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects a new password outside the 8–128 character boundary', async () => {
    await expect(changePassword({}, form('old-password', 'short', 'short')))
      .resolves.toEqual({ error: 'passwordLength' })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rejects reusing the current password', async () => {
    await expect(changePassword({}, form('same-password', 'same-password', 'same-password')))
      .resolves.toEqual({ error: 'passwordUnchanged' })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('rate-limits repeated password-change attempts', async () => {
    mocks.rateLimit.mockResolvedValue(false)

    await expect(changePassword({}, form())).resolves.toEqual({ error: 'rateLimited' })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('changes the hash, revokes reset tokens and sessions, audits, then signs out', async () => {
    await changePassword({}, form())

    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: 'new-hash',
      sessionVersion: expect.anything(),
    }))
    expect(mocks.delete).toHaveBeenCalled()
    expect(mocks.audit).toHaveBeenCalledWith('user-1', 'user.password_change', 'user', 'user-1')
    expect(mocks.signOut).toHaveBeenCalledWith({ redirectTo: '/auth/login?reset=ok' })
  })
})
