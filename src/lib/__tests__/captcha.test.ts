import { describe, it, expect, beforeAll } from 'vitest'
import { issueCaptchaToken, verifyCaptchaToken } from '../captcha'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret' })

describe('captcha token', () => {
  it('verifikasi jawaban benar, case-insensitive', () => {
    const token = issueCaptchaToken('AbC3d')
    expect(verifyCaptchaToken('abc3D', token)).toBe(true)
  })

  it('menolak jawaban salah', () => {
    const token = issueCaptchaToken('AbC3d')
    expect(verifyCaptchaToken('xxxxx', token)).toBe(false)
  })

  it('menolak replay (single-use nonce)', () => {
    const token = issueCaptchaToken('AbC3d')
    expect(verifyCaptchaToken('abc3d', token)).toBe(true)
    expect(verifyCaptchaToken('abc3d', token)).toBe(false)
  })

  it('menolak token kedaluwarsa', () => {
    const token = issueCaptchaToken('AbC3d', Date.now() - 11 * 60_000)
    expect(verifyCaptchaToken('abc3d', token)).toBe(false)
  })

  it('menolak token cacat', () => {
    expect(verifyCaptchaToken('abc3d', 'bukan.token')).toBe(false)
    expect(verifyCaptchaToken('abc3d', '')).toBe(false)
  })
})
