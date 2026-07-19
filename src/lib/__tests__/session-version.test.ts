import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }))

vi.mock('@/db', () => ({
  db: { query: { users: { findFirst: mocks.findFirst } } },
}))

const { refreshSessionToken } = await import('../session-version')

describe('refreshSessionToken', () => {
  beforeEach(() => vi.resetAllMocks())

  it('revokes a JWT after the user session version changes', async () => {
    mocks.findFirst.mockResolvedValue({ status: 'active', role: 'developer', sessionVersion: 2 })

    await expect(refreshSessionToken({ sub: 'user-1', role: 'developer', sessionVersion: 1 }))
      .resolves.toBeNull()
  })

  it('keeps a legacy JWT when the stored session version is still zero', async () => {
    mocks.findFirst.mockResolvedValue({ status: 'active', role: 'portal-admin', sessionVersion: 0 })

    await expect(refreshSessionToken({ sub: 'user-1', role: 'developer' })).resolves.toMatchObject({
      sub: 'user-1',
      role: 'portal-admin',
      sessionVersion: 0,
    })
  })
})
