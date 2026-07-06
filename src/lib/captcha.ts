import { createHash, timingSafeEqual } from 'node:crypto'

export function captchaDigest(answer: string): string {
  return createHash('sha256')
    .update(answer.toLowerCase() + process.env.AUTH_SECRET!)
    .digest('hex')
}

export function verifyCaptchaAnswer(answer: string, digest: string): boolean {
  const a = Buffer.from(captchaDigest(answer))
  const b = Buffer.from(digest)
  return a.length === b.length && timingSafeEqual(a, b)
}
