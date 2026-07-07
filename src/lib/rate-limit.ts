import { headers } from 'next/headers'
import { getRedis } from '@/lib/redis'

// Fixed-window counter. Redis kalau REDIS_URL diset (aman multi-replica);
// fallback in-memory per-instance kalau tidak / Redis down.
const buckets = new Map<string, number[]>()

function memoryLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
  }
  return true
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      const bucket = Math.floor(Date.now() / windowMs)
      const k = `rl:${key}:${bucket}`
      const n = await redis.incr(k)
      if (n === 1) await redis.pexpire(k, windowMs)
      return n <= limit
    } catch {
      // Redis down -> jangan mengunci user; pakai fallback memory
    }
  }
  return memoryLimit(key, limit, windowMs)
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local'
}
