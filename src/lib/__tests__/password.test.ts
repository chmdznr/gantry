import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

describe('password', () => {
  it('hashes and verifies roundtrip', async () => {
    const hash = await hashPassword('s3cret-pw')
    expect(hash).not.toContain('s3cret-pw')
    expect(await verifyPassword('s3cret-pw', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
