import { describe, it, expect, beforeAll, vi } from 'vitest'
import { hashPassword } from '../password'

const findFirst = vi.fn()
vi.mock('@/db', () => ({ db: { query: { users: { findFirst: (...args: unknown[]) => findFirst(...args) } } } }))

const { authorizeUser } = await import('../authorize')

const baseUser = {
  id: 'user-1',
  email: 'dev@example.com',
  name: 'Dev User',
  role: 'developer',
  emailVerifiedAt: new Date(),
  status: 'active',
}

describe('authorizeUser', () => {
  let passwordHash: string

  beforeAll(async () => {
    passwordHash = await hashPassword('correct-pw')
  })

  it('rejects unknown user', async () => {
    findFirst.mockResolvedValueOnce(undefined)
    expect(await authorizeUser('nobody@example.com', 'correct-pw')).toBeNull()
  })

  it('rejects wrong password', async () => {
    findFirst.mockResolvedValueOnce({ ...baseUser, passwordHash })
    expect(await authorizeUser(baseUser.email, 'wrong-pw')).toBeNull()
  })

  it('rejects unverified email', async () => {
    findFirst.mockResolvedValueOnce({ ...baseUser, passwordHash, emailVerifiedAt: null })
    expect(await authorizeUser(baseUser.email, 'correct-pw')).toBeNull()
  })

  it('rejects non-active status', async () => {
    findFirst.mockResolvedValueOnce({ ...baseUser, passwordHash, status: 'pending' })
    expect(await authorizeUser(baseUser.email, 'correct-pw')).toBeNull()
  })

  it('returns user on valid credentials', async () => {
    findFirst.mockResolvedValueOnce({ ...baseUser, passwordHash })
    expect(await authorizeUser(baseUser.email, 'correct-pw')).toEqual({
      id: baseUser.id, email: baseUser.email, name: baseUser.name, role: baseUser.role,
    })
  })
})
