import { describe, it, expect } from 'vitest'
import { generateToken, tokenExpiry } from '../tokens'

describe('tokens', () => {
  it('generates 64-char hex unique tokens', () => {
    const t1 = generateToken()
    expect(t1).toMatch(/^[0-9a-f]{64}$/)
    expect(generateToken()).not.toBe(t1)
  })
  it('expiry is in the future', () => {
    expect(tokenExpiry(24).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000)
  })
})
