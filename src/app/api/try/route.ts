import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { findSpecOperationMatch } from '@/lib/routable'
import {
  MAX_JSON_BODY,
  MAX_MULTIPART_BYTES,
  TryItError,
  assertCanonicalTarget,
  parseControlEnvelope,
  resolveHeaders,
  specHeaderParams,
  type ControlEnvelope,
} from '@/lib/tryit'

const ALLOWED_METHODS: Record<string, true> = {
  GET: true,
  POST: true,
  PUT: true,
  PATCH: true,
  DELETE: true,
  HEAD: true,
  OPTIONS: true,
}
const UPSTREAM_TIMEOUT_MS = 15000
const INBOUND_TIMEOUT_MS = 15000
const MAX_CONCURRENT_UPLOADS = 3
const BODY_METHODS: Record<string, true> = { GET: true, HEAD: true }

// ponytail: semaphore per-proses. Cukup untuk satu instance Next; pindah ke Redis
// kalau portal dijalankan multi-replika dan batas upload perlu global.
let activeUploads = 0

const RESPONSE_HEADERS = [
  'content-type',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-kong-response-latency',
]

// Proxy try-it: target terkunci ke proxyBaseUrl produk (bukan open relay).
// Authz API sesungguhnya tetap ditegakkan Kong lewat apikey milik developer.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: 'Harus login.' }, { status: 401 })

  if ((req.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    // F1: tolak berdasarkan Content-Length SEBELUM body dibaca/parse.
    const declared = Number(req.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > MAX_MULTIPART_BYTES) {
      return Response.json({ error: 'Upload exceeds the 10 MB limit.', code: 'uploadTooLarge' }, { status: 413 })
    }
    if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
      return Response.json(
        { error: 'Too many concurrent uploads. Try again shortly.', code: 'tooManyConcurrent' },
        { status: 429 },
      )
    }
    activeUploads++
    try {
      return await handleMultipart(req)
    } finally {
      activeUploads--
    }
  }

  return handleJson(req)
}

async function handleJson(req: Request) {
  let payload: {
    productId?: string
    method?: string
    path?: string
    apiKey?: string
    headers?: Record<string, string>
    body?: string
    contentType?: string
  }
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
  }

  const method = String(payload.method ?? 'GET').toUpperCase()
  const path = String(payload.path ?? '/')
  if (!Object.hasOwn(ALLOWED_METHODS, method)) return Response.json({ error: 'Method tidak didukung.' }, { status: 400 })
  if (!path.startsWith('/')) return Response.json({ error: 'Path harus diawali /.' }, { status: 400 })

  const product = await db.query.apiProducts.findFirst({
    where: and(eq(apiProducts.id, String(payload.productId ?? '')), inArray(apiProducts.status, ['published', 'deprecated'])),
  })
  if (!product) return Response.json({ error: 'API tidak ditemukan.' }, { status: 404 })

  // Guard: hanya endpoint yang terdaftar di spec produk yang boleh di-proxy.
  // Mencegah user memakai portal untuk probing path yang tidak terdokumentasi
  // (authz asli tetap ditegakkan Kong; ini lapisan tambahan sesuai maksud portal).
  const spec = product.openapiSpec as { paths?: Record<string, Record<string, unknown>> } | null
  const match = spec?.paths ? findSpecOperationMatch(path, method, spec.paths) : undefined
  if (!match) {
    return Response.json({ error: 'Endpoint tidak terdaftar pada spec API ini.' }, { status: 400 })
  }

  const target = product.proxyBaseUrl.replace(/\/$/, '') + path
  try {
    assertCanonicalTarget(target, path, product.proxyBaseUrl)
  } catch (err) {
    return errorResponse(err)
  }

  const headers: Record<string, string> = {}
  if (payload.apiKey) headers['apikey'] = String(payload.apiKey).slice(0, 512)
  if (payload.contentType) headers['Content-Type'] = String(payload.contentType).slice(0, 128)
  try {
    const allowed = specHeaderParams(match.pathItem, match.operation).map((p) => p.name)
    Object.assign(headers, resolveHeaders(payload.headers, allowed))
  } catch (err) {
    return errorResponse(err)
  }

  return proxy(target, method, headers, payload.body?.slice(0, MAX_JSON_BODY))
}

async function handleMultipart(req: Request) {
  let form: FormData
  let controls: ControlEnvelope
  try {
    form = await readLimitedMultipart(req)
    controls = parseControlEnvelope(form)
  } catch (err) {
    return errorResponse(err)
  }

  const method = controls.method.toUpperCase()
  const path = controls.path
  if (!Object.hasOwn(ALLOWED_METHODS, method)) return Response.json({ error: 'Method tidak didukung.' }, { status: 400 })
  if (!path.startsWith('/')) return Response.json({ error: 'Path harus diawali /.' }, { status: 400 })

  const product = await db.query.apiProducts.findFirst({
    where: and(eq(apiProducts.id, controls.productId), inArray(apiProducts.status, ['published', 'deprecated'])),
  })
  if (!product) return Response.json({ error: 'API tidak ditemukan.' }, { status: 404 })

  // Guard spec dibaca ulang dari DB (JANGAN percaya bodyContentType dari client).
  const spec = product.openapiSpec as { paths?: Record<string, Record<string, unknown>> } | null
  const match = spec?.paths ? findSpecOperationMatch(path, method, spec.paths) : undefined
  if (!match) {
    return Response.json({ error: 'Endpoint tidak terdaftar pada spec API ini.' }, { status: 400 })
  }
  // F4: hard-block upload multipart ke operasi yang tidak mendeklarasikannya.
  if (!declaresMultipart(match.operation)) {
    return Response.json(
      { error: 'Endpoint tidak mendeklarasikan multipart/form-data pada spec API ini.', code: 'multipartUnsupportedBySpec' },
      { status: 400 },
    )
  }

  const target = product.proxyBaseUrl.replace(/\/$/, '') + path
  try {
    assertCanonicalTarget(target, path, product.proxyBaseUrl)
  } catch (err) {
    return errorResponse(err)
  }

  // Rekonstruksi FormData baru: file native (tanpa copy header multipart client),
  // field berulang dengan nama sama di-append semua. Header client tidak diteruskan;
  // undici menyusun boundary sendiri.
  const outbound = new FormData()
  for (const [name, value] of controls.parts) outbound.append(name, value)

  const headers: Record<string, string> = {}
  if (controls.apiKey) headers['apikey'] = controls.apiKey.slice(0, 512)
  try {
    const allowed = specHeaderParams(match.pathItem, match.operation).map((p) => p.name)
    Object.assign(headers, resolveHeaders(controls.headers, allowed))
  } catch (err) {
    return errorResponse(err)
  }

  return proxy(target, method, headers, outbound)
}

function declaresMultipart(operation: Record<string, unknown>): boolean {
  const requestBody = operation.requestBody as { content?: Record<string, unknown> } | undefined
  const content = requestBody?.content
  if (!content || typeof content !== 'object') return false
  return Object.keys(content).some((k) => k.split(';')[0].trim().toLowerCase() === 'multipart/form-data')
}

// Baca body multipart dengan dua lapis batas: Content-Length dicek di POST, dan
// penghitung byte in-flight di sini untuk request chunked / header bohong. Melewati
// batas = stream dibatalkan seketika, bukan dipotong (reject semantics).
async function readLimitedMultipart(req: Request): Promise<FormData> {
  const body = req.body
  const contentType = req.headers.get('content-type') ?? ''
  if (!body) throw new TryItError('Invalid multipart body.', 400, 'multipartInvalid')

  const reader = body.getReader()
  const chunks: BlobPart[] = []
  let total = 0
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    void reader.cancel().catch(() => {})
  }, INBOUND_TIMEOUT_MS)

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (timedOut) throw new TryItError('Upload timed out after 15 seconds.', 408, 'uploadTimeout')
      if (done) break
      total += value.byteLength
      if (total > MAX_MULTIPART_BYTES) {
        throw new TryItError('Upload exceeds the 10 MB limit.', 413, 'uploadTooLarge')
      }
      chunks.push(value)
    }
  } catch (err) {
    if (err instanceof TryItError) throw err
    throw new TryItError('Invalid multipart body.', 400, 'multipartInvalid')
  } finally {
    clearTimeout(timer)
    void reader.cancel().catch(() => {})
  }

  try {
    return await new Response(new Blob(chunks, { type: contentType }), {
      headers: { 'content-type': contentType },
    }).formData()
  } catch {
    throw new TryItError('Invalid multipart body.', 400, 'multipartInvalid')
  }
}

async function proxy(target: string, method: string, headers: Record<string, string>, body: BodyInit | undefined) {
  const started = Date.now()
  try {
    const res = await fetch(target, {
      method,
      headers,
      body: Object.hasOwn(BODY_METHODS, method) ? undefined : body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
      redirect: 'manual',
    })
    const text = (await res.text()).slice(0, MAX_JSON_BODY)
    const resHeaders: Record<string, string> = {}
    for (const k of RESPONSE_HEADERS) {
      const v = res.headers.get(k)
      if (v) resHeaders[k] = v
    }
    return Response.json({ status: res.status, durationMs: Date.now() - started, headers: resHeaders, body: text })
  } catch (err) {
    const msg = err instanceof Error && err.name === 'TimeoutError' ? 'Timeout 15 detik.' : 'Gagal menghubungi gateway.'
    return Response.json({ error: msg }, { status: 502 })
  }
}

function errorResponse(err: unknown): Response {
  if (err instanceof TryItError) {
    return Response.json(
      { error: err.message, ...(err.code ? { code: err.code } : {}) },
      { status: err.status },
    )
  }
  throw err
}
