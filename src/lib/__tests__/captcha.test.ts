import { describe, it, expect, beforeAll } from 'vitest'
import { issueCaptchaToken, verifyCaptchaToken } from '../captcha'

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret' })

describe('captcha token', () => {
  it('verifikasi jawaban benar, case-insensitive', async () => {
    const token = issueCaptchaToken('AbC3d')
    expect(await verifyCaptchaToken('abc3D', token)).toBe(true)
  })

  it('menolak jawaban salah', async () => {
    const token = issueCaptchaToken('AbC3d')
    expect(await verifyCaptchaToken('xxxxx', token)).toBe(false)
  })

  it('menolak replay (single-use nonce)', async () => {
    const token = issueCaptchaToken('AbC3d')
    expect(await verifyCaptchaToken('abc3d', token)).toBe(true)
    expect(await verifyCaptchaToken('abc3d', token)).toBe(false)
  })

  it('menolak token kedaluwarsa', async () => {
    const token = issueCaptchaToken('AbC3d', Date.now() - 11 * 60_000)
    expect(await verifyCaptchaToken('abc3d', token)).toBe(false)
  })

  it('menolak token cacat', async () => {
    expect(await verifyCaptchaToken('abc3d', 'bukan.token')).toBe(false)
    expect(await verifyCaptchaToken('abc3d', '')).toBe(false)
  })
})
