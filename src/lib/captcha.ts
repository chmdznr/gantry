import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

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

// ponytail: single-use nonce in-memory; per-instance, pindah ke Redis kalau multi-replica
const usedNonces = new Set<string>()

export function verifyCaptchaToken(answer: string, token: string, now = Date.now()): boolean {
  const [expStr, nonce, sig] = token.split('.')
  const exp = Number(expStr)
  if (!exp || !nonce || !sig || exp < now) return false
  if (usedNonces.has(nonce)) return false
  const expected = Buffer.from(mac(`${answer.toLowerCase()}|${exp}|${nonce}`))
  const got = Buffer.from(sig)
  const ok = expected.length === got.length && timingSafeEqual(expected, got)
  if (ok) {
    usedNonces.add(nonce)
    if (usedNonces.size > 50_000) usedNonces.clear()
  }
  return ok
}
