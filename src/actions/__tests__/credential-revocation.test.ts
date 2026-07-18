import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findApp: vi.fn(),
  findCredential: vi.fn(),
  deleteRows: vi.fn(),
  deleteWhere: vi.fn(),
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
  audit: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    query: {
      applications: { findFirst: mocks.findApp },
      appCredentials: { findFirst: mocks.findCredential },
    },
    delete: mocks.deleteRows,
  },
}))
vi.mock('@/lib/require-admin', () => ({
  requireUser: mocks.requireUser,
  requireAdmin: mocks.requireAdmin,
}))
vi.mock('@/lib/audit', () => ({ audit: mocks.audit }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import { revokeCredential } from '@/actions/apps'
import { adminRevokeCredential } from '@/actions/admin-consumers'

const actionCases = [
  {
    name: 'owner key-auth revoke',
    type: 'key-auth',
    path: 'key-auth',
    run: () => revokeCredential('app-1', 'cred-1'),
  },
  {
    name: 'admin JWT revoke',
    type: 'jwt',
    path: 'jwt',
    run: () => adminRevokeCredential('app-1', 'cred-1'),
  },
] as const

describe('credential revocation retry', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.KONG_ADMIN_URL = 'http://kong:8001'
    mocks.findApp.mockResolvedValue({
      id: 'app-1',
      ownerUserId: 'user-1',
      name: 'Test app',
      kongConsumerId: 'consumer-1',
    })
    mocks.deleteRows.mockReturnValue({ where: mocks.deleteWhere })
    mocks.requireUser.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.requireAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.audit.mockResolvedValue(undefined)
  })

  it.each(actionCases)('$name removes the stale row when retry sees Kong 404', async ({ type, path, run }) => {
    const dbError = new Error('database failed')
    mocks.findCredential.mockResolvedValue({
      id: 'cred-1',
      applicationId: 'app-1',
      type,
      kongCredentialId: 'kong-cred-1',
    })
    mocks.deleteWhere.mockRejectedValueOnce(dbError).mockResolvedValueOnce(undefined)
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })

    await expect(run()).rejects.toBe(dbError)
    await expect(run()).resolves.toBeUndefined()

    expect(mocks.deleteWhere).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `http://kong:8001/consumers/consumer-1/${path}/kong-cred-1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
