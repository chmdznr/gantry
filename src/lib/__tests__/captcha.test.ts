import { describe, it, expect, beforeAll } from 'vitest'
import { captchaDigest, verifyCaptchaAnswer } from '../captcha'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret' })

describe('captcha', () => {
  it('verifies correct answer case-insensitively', () => {
    const digest = captchaDigest('AbC3d')
    expect(verifyCaptchaAnswer('abc3D', digest)).toBe(true)
  })
  it('rejects wrong answer', () => {
    const digest = captchaDigest('AbC3d')
    expect(verifyCaptchaAnswer('xxxxx', digest)).toBe(false)
  })
})
