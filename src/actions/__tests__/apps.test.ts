import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findApp: vi.fn(),
  insert: vi.fn(),
  insertValues: vi.fn(),
  requireUser: vi.fn(),
  audit: vi.fn(),
  revalidatePath: vi.fn(),
  getTranslations: vi.fn(),
  createConsumer: vi.fn(),
  deleteConsumer: vi.fn(),
  createKeyAuth: vi.fn(),
  createJwtCred: vi.fn(),
  deleteKeyAuth: vi.fn(),
  deleteJwtCred: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    query: { applications: { findFirst: mocks.findApp } },
    insert: mocks.insert,
  },
}))
vi.mock('@/lib/require-admin', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/audit', () => ({ audit: mocks.audit }))
vi.mock('@/lib/kong', () => ({
  createConsumer: mocks.createConsumer,
  deleteConsumer: mocks.deleteConsumer,
  createKeyAuth: mocks.createKeyAuth,
  createJwtCred: mocks.createJwtCred,
  deleteKeyAuth: mocks.deleteKeyAuth,
  deleteJwtCred: mocks.deleteJwtCred,
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next-intl/server', () => ({ getTranslations: mocks.getTranslations }))

import { createApp, createCredential } from '@/actions/apps'

const credentialCases = [
  {
    type: 'key-auth' as const,
    credential: { id: 'key-id', key: 'key-value' },
    create: mocks.createKeyAuth,
    remove: mocks.deleteKeyAuth,
    secret: { type: 'key-auth', key: 'key-value' },
  },
  {
    type: 'jwt' as const,
    credential: { id: 'jwt-id', key: 'jwt-key', secret: 'jwt-secret' },
    create: mocks.createJwtCred,
    remove: mocks.deleteJwtCred,
    secret: { type: 'jwt', key: 'jwt-key', jwtSecret: 'jwt-secret' },
  },
] as const

function credentialForm(type: 'key-auth' | 'jwt') {
  const formData = new FormData()
  formData.set('appId', 'app-1')
  formData.set('type', type)
  return formData
}

describe('createCredential compensation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.findApp.mockResolvedValue({
      id: 'app-1',
      ownerUserId: 'user-1',
      name: 'Test app',
      description: '',
      kongConsumerUsername: 'app-app-1',
      kongConsumerId: 'consumer-1',
      blockedAt: null,
      createdAt: new Date(0),
    })
    mocks.insert.mockReturnValue({ values: mocks.insertValues })
    mocks.insertValues.mockResolvedValue(undefined)
    mocks.requireUser.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.audit.mockResolvedValue(undefined)
    mocks.getTranslations.mockResolvedValue((key: string) => key)
    mocks.createConsumer.mockResolvedValue({ id: 'consumer-1' })
    mocks.deleteConsumer.mockResolvedValue(undefined)
    mocks.deleteKeyAuth.mockResolvedValue(undefined)
    mocks.deleteJwtCred.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(credentialCases)('awaits $type deletion when persistence fails', async ({
    type,
    credential,
    create,
    remove,
  }) => {
    const dbError = new Error('database failed')
    let resolveDelete!: () => void
    create.mockResolvedValueOnce(credential)
    mocks.insertValues.mockRejectedValueOnce(dbError)
    remove.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveDelete = resolve
    }))

    const action = createCredential({}, credentialForm(type))
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith('consumer-1', credential.id))
    let settled = false
    void action.then(() => {
      settled = true
    })
    await Promise.resolve()

    expect(settled).toBe(false)
    expect(type === 'key-auth' ? mocks.deleteJwtCred : mocks.deleteKeyAuth).not.toHaveBeenCalled()

    resolveDelete()
    await expect(action).resolves.toEqual({ error: 'credCreateFailed' })
  })

  it.each(credentialCases)('does not delete $type after successful persistence', async ({
    type,
    credential,
    create,
    secret,
  }) => {
    create.mockResolvedValueOnce(credential)

    await expect(createCredential({}, credentialForm(type))).resolves.toEqual({ secret })
    expect(mocks.insertValues).toHaveBeenCalledWith({
      applicationId: 'app-1',
      type,
      kongCredentialId: credential.id,
      hint: credential.key.slice(-4),
    })
    expect(mocks.deleteKeyAuth).not.toHaveBeenCalled()
    expect(mocks.deleteJwtCred).not.toHaveBeenCalled()
  })

  it.each(credentialCases)('preserves database and $type cleanup errors', async ({
    type,
    credential,
    create,
    remove,
  }) => {
    const dbError = new Error('database failed')
    const cleanupError = new Error('cleanup failed')
    create.mockResolvedValueOnce(credential)
    mocks.insertValues.mockRejectedValueOnce(dbError)
    remove.mockRejectedValueOnce(cleanupError)

    await expect(createCredential({}, credentialForm(type))).resolves.toEqual({ error: 'credCreateFailed' })

    const loggedError = vi.mocked(console.error).mock.calls.at(-1)?.[1]
    expect(loggedError).toBeInstanceOf(AggregateError)
    expect((loggedError as AggregateError).errors).toEqual([dbError, cleanupError])
  })

  it('preserves database and Consumer cleanup errors while translating the result', async () => {
    const dbError = new Error('database failed')
    const cleanupError = new Error('cleanup failed')
    const formData = new FormData()
    formData.set('name', 'Test app')
    mocks.insertValues.mockRejectedValueOnce(dbError)
    mocks.deleteConsumer.mockRejectedValueOnce(cleanupError)

    await expect(createApp({}, formData)).resolves.toEqual({ error: 'appSaveFailed' })

    expect(mocks.deleteConsumer).toHaveBeenCalledWith('consumer-1')
    const loggedError = vi.mocked(console.error).mock.calls.at(-1)?.[1]
    expect(loggedError).toBeInstanceOf(AggregateError)
    expect((loggedError as AggregateError).errors).toEqual([dbError, cleanupError])
  })
})
