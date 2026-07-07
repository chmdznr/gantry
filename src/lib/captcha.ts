import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getRedis } from '@/lib/redis'

const TTL_MS = 10 * 60_000

function mac(payload: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET!).update(payload).digest('hex')
}

// Token anti-replay: exp.nonce.mac — mac mengikat jawaban+exp+nonce.
export function issueCaptchaToken(answer: string, now = Date.now()): string {
  const exp = now + TTL_MS
  const nonce = randomBytes(8).toString('hex')
  return `${exp}.${nonce}.${mac(`${answer.toLowerCase()}|${exp}|${nonce}`)}`
}

// Single-use nonce: Redis SET NX kalau tersedia (multi-replica), fallback in-memory.
const usedNonces = new Set<string>()

async function markNonceUsed(nonce: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      const res = await redis.set(`captcha:nonce:${nonce}`, '1', 'PX', TTL_MS, 'NX')
      return res === 'OK' // null = sudah pernah dipakai
    } catch {
      // Redis down -> fallback memory
    }
  }
  if (usedNonces.has(nonce)) return false
  usedNonces.add(nonce)
  if (usedNonces.size > 50_000) usedNonces.clear()
  return true
}

export async function verifyCaptchaToken(answer: string, token: string, now = Date.now()): Promise<boolean> {
  const [expStr, nonce, sig] = token.split('.')
  const exp = Number(expStr)
  if (!exp || !nonce || !sig || exp < now) return false
  const expected = Buffer.from(mac(`${answer.toLowerCase()}|${exp}|${nonce}`))
  const got = Buffer.from(sig)
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return false
  return markNonceUsed(nonce)
}
