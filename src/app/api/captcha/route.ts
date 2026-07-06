import svgCaptcha from 'svg-captcha'
import { cookies } from 'next/headers'
import { captchaDigest } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

export async function GET() {
  const captcha = svgCaptcha.create({ size: 5, noise: 3, ignoreChars: '0oO1ilI' })
  const jar = await cookies()
  jar.set('captcha_digest', captchaDigest(captcha.text), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600,
  })
  return new Response(captcha.data, { headers: { 'Content-Type': 'image/svg+xml' } })
}
