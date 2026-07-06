import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'

const MAX_BODY = 100 * 1024
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

// Proxy try-it: target terkunci ke proxyBaseUrl produk (bukan open relay).
// Authz API sesungguhnya tetap ditegakkan Kong lewat apikey milik developer.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Harus login.' }, { status: 401 })

  let payload: { productId?: string; method?: string; path?: string; apiKey?: string; body?: string; contentType?: string }
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
  }
  const method = String(payload.method ?? 'GET').toUpperCase()
  const path = String(payload.path ?? '/')
  if (!ALLOWED_METHODS.has(method)) return Response.json({ error: 'Method tidak didukung.' }, { status: 400 })
  if (!path.startsWith('/')) return Response.json({ error: 'Path harus diawali /.' }, { status: 400 })

  const product = await db.query.apiProducts.findFirst({
    where: and(eq(apiProducts.id, String(payload.productId ?? '')), inArray(apiProducts.status, ['published', 'deprecated'])),
  })
  if (!product) return Response.json({ error: 'API tidak ditemukan.' }, { status: 404 })

  const headers: Record<string, string> = {}
  if (payload.apiKey) headers['apikey'] = String(payload.apiKey).slice(0, 512)
  if (payload.contentType) headers['Content-Type'] = String(payload.contentType).slice(0, 128)

  const started = Date.now()
  try {
    const res = await fetch(product.proxyBaseUrl.replace(/\/$/, '') + path, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : payload.body?.slice(0, MAX_BODY),
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
      redirect: 'manual',
    })
    const text = (await res.text()).slice(0, MAX_BODY)
    const resHeaders: Record<string, string> = {}
    for (const k of ['content-type', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'x-kong-response-latency']) {
      const v = res.headers.get(k)
      if (v) resHeaders[k] = v
    }
    return Response.json({ status: res.status, durationMs: Date.now() - started, headers: resHeaders, body: text })
  } catch (err) {
    const msg = err instanceof Error && err.name === 'TimeoutError' ? 'Timeout 15 detik.' : 'Gagal menghubungi gateway.'
    return Response.json({ error: msg }, { status: 502 })
  }
}
