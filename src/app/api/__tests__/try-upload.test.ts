import { createHash } from 'node:crypto'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findProduct: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/db', () => ({
  db: { query: { apiProducts: { findFirst: mocks.findProduct } } },
}))

import { POST } from '@/app/api/try/route'
import { MAX_JSON_BODY, MAX_MULTIPART_BYTES } from '@/lib/tryit'

type ReceivedPart = {
  name: string
  filename: string | null
  type: string | null
  size: number
  sha256: string
  text?: string
}

type Received = {
  method: string
  url: string
  headers: IncomingHttpHeaders
  raw: Buffer
  parts: ReceivedPart[]
}

const PORTAL_URL = 'http://portal.test/api/try'
const APP_KEY = 'portal-key-123'

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

// Deterministic pseudo-binary payload of arbitrary size.
function pattern(size: number) {
  const out = new Uint8Array(size)
  for (let i = 0; i < size; i++) out[i] = i % 251
  return out
}

let server: Server
let baseUrl = ''
const received: Received[] = []

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const raw = Buffer.concat(chunks)
    const contentType = String(req.headers['content-type'] ?? '')

    const parts: ReceivedPart[] = []
    if (contentType.startsWith('multipart/form-data')) {
      const parsed = await new Request('http://upstream.test/', {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: raw as unknown as BodyInit,
      }).formData()
      for (const [name, value] of parsed.entries()) {
        if (typeof value === 'string') {
          parts.push({
            name,
            filename: null,
            type: null,
            size: Buffer.byteLength(value),
            sha256: sha256(new TextEncoder().encode(value)),
            text: value,
          })
        } else {
          const bytes = new Uint8Array(await value.arrayBuffer())
          parts.push({
            name,
            filename: value.name,
            type: value.type,
            size: value.size,
            sha256: sha256(bytes),
          })
        }
      }
    }

    received.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, raw, parts })

    // Real delay on purpose: the concurrency test needs 3 in-flight fetches to overlap
    // against a real socket; fake timers cannot coordinate the route's own async work.
    if (req.url?.startsWith('/slow')) await new Promise((resolve) => setTimeout(resolve, 300))

    if (req.url?.startsWith('/rate-limited')) {
      res.writeHead(429, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'rate limited by kong' }))
      return
    }

    res.writeHead(200, {
      'content-type': req.url?.startsWith('/echo') ? 'text/plain' : 'application/json',
      'ratelimit-limit': '5',
      'ratelimit-remaining': '4',
      'x-kong-response-latency': '3',
    })
    if (req.url?.startsWith('/echo')) {
      res.end('r'.repeat(MAX_JSON_BODY + 500))
      return
    }
    res.end(JSON.stringify({ ok: true, path: req.url }))
  })

  const listening = Promise.withResolvers<void>()
  server.listen(0, '127.0.0.1', listening.resolve)
  await listening.promise
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  server.closeAllConnections()
  const closed = Promise.withResolvers<void>()
  server.close((err) => (err ? closed.reject(err) : closed.resolve()))
  await closed.promise
})

function makeProduct() {
  return {
    id: 'prod-1',
    slug: 'upload-api',
    name: 'Upload API',
    openapiSpec: {
      openapi: '3.0.0',
      paths: {
        '/upload': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      file: { type: 'string', format: 'binary' },
                      files: { type: 'array', items: { type: 'string', format: 'binary' } },
                      note: { type: 'string' },
                    },
                    required: ['file'],
                  },
                },
              },
            },
          },
        },
        '/files/{id}': {
          post: {
            requestBody: {
              content: { 'multipart/form-data': { schema: { type: 'object' } } },
            },
          },
        },
        '/files/{id}/health': {
          post: {
            requestBody: {
              content: { 'multipart/form-data': { schema: { type: 'object' } } },
            },
          },
        },
        '/slow': {
          post: {
            requestBody: {
              content: { 'multipart/form-data': { schema: { type: 'object' } } },
            },
          },
        },
        '/rate-limited': {
          post: {
            requestBody: {
              content: { 'multipart/form-data': { schema: { type: 'object' } } },
            },
          },
        },
        '/json-only': {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
        '/echo': {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
    },
    proxyBaseUrl: baseUrl,
    status: 'published',
  }
}

beforeEach(() => {
  received.length = 0
  mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
  mocks.findProduct.mockResolvedValue(makeProduct())
})

afterEach(() => {
  vi.clearAllMocks()
})

const CONTROLS = {
  '@productId': 'prod-1',
  '@method': 'POST',
  '@apiKey': APP_KEY,
}

// Browser-shaped client: native FormData, no explicit content-length.
function multipartRequest(
  controls: Record<string, string>,
  entries: Array<{ name: string; value: string | File }>,
) {
  const form = new FormData()
  for (const [name, value] of Object.entries(controls)) form.set(name, value)
  for (const entry of entries) form.append(entry.name, entry.value)
  return new Request(PORTAL_URL, { method: 'POST', body: form })
}

type RawFile = { name: string; filename: string; type: string; data: Uint8Array }

// Raw multipart with an explicit Content-Length, so size can be rejected pre-parse.
function rawMultipart(values: Record<string, string>, files: RawFile[], withLength: boolean) {
  const boundary = `----tryit-test-${Math.random().toString(16).slice(2)}`
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  for (const [name, value] of Object.entries(values)) {
    chunks.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`))
  }
  for (const file of files) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.type}\r\n\r\n`,
      ),
    )
    chunks.push(file.data)
    chunks.push(encoder.encode('\r\n'))
  }
  chunks.push(encoder.encode(`--${boundary}--\r\n`))

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }

  const headers: Record<string, string> = { 'content-type': `multipart/form-data; boundary=${boundary}` }
  if (withLength) headers['content-length'] = String(total)
  return new Request(PORTAL_URL, { method: 'POST', headers, body })
}

type TryResponse = {
  status?: number
  durationMs?: number
  headers?: Record<string, string>
  body?: string
  error?: string
}

describe('POST /api/try multipart upload', () => {
  it('forwards exact file bytes, filename, MIME and apikey header to the upstream', async () => {
    const bytes = pattern(2 * 1024 * 1024)
    const res = await POST(
      multipartRequest(
        { ...CONTROLS, '@path': '/upload', note: 'hello' },
        [{ name: 'file', value: new File([bytes as unknown as BlobPart], 'report.pdf', { type: 'application/pdf' }) }],
      ),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as TryResponse
    expect(json.status).toBe(200)
    expect(received).toHaveLength(1)

    const upstream = received[0]
    expect(upstream.method).toBe('POST')
    expect(upstream.url).toBe('/upload')
    expect(upstream.headers.apikey).toBe(APP_KEY)

    const file = upstream.parts.find((part) => part.name === 'file')
    expect(file).toMatchObject({
      filename: 'report.pdf',
      type: 'application/pdf',
      size: bytes.length,
      sha256: sha256(bytes),
    })
    expect(upstream.parts.find((part) => part.name === 'note')?.text).toBe('hello')

    // Controls/credentials stay in the envelope; never forwarded as upstream parts.
    expect(upstream.parts.some((part) => part.name.startsWith('@'))).toBe(false)
    expect(upstream.parts.map((part) => part.name)).not.toContain('apiKey')
    expect(upstream.parts.map((part) => part.name)).not.toContain('productId')
  })

  it('forwards every file when a binary field is repeated', async () => {
    const first = pattern(1024)
    const second = pattern(2048)
    const res = await POST(
      multipartRequest({ ...CONTROLS, '@path': '/upload' }, [
        { name: 'files', value: new File([first as unknown as BlobPart], 'a.bin', { type: 'application/octet-stream' }) },
        { name: 'files', value: new File([second as unknown as BlobPart], 'b.bin', { type: 'image/png' }) },
      ]),
    )

    expect(res.status).toBe(200)
    expect(received).toHaveLength(1)
    const files = received[0].parts.filter((part) => part.name === 'files')
    expect(files).toHaveLength(2)
    expect(files.map((part) => part.filename)).toEqual(['a.bin', 'b.bin'])
    expect(files.map((part) => part.sha256)).toEqual([sha256(first), sha256(second)])
    expect(files.map((part) => part.type)).toEqual(['application/octet-stream', 'image/png'])
  })

  it('rejects a total body over the multipart cap with 413 before parsing or forwarding', async () => {
    const oversized = pattern(MAX_MULTIPART_BYTES + 1024)
    const res = await POST(
      rawMultipart({ ...CONTROLS, '@path': '/upload' }, [
        { name: 'file', filename: 'huge.bin', type: 'application/octet-stream', data: oversized },
      ], true),
    )

    expect(res.status).toBe(413)
    expect(received).toHaveLength(0)
  })

  it('rejects an oversized chunked body (no Content-Length) with 413', async () => {
    const oversized = pattern(MAX_MULTIPART_BYTES + 1024)
    const request = rawMultipart({ ...CONTROLS, '@path': '/upload' }, [
      { name: 'file', filename: 'huge.bin', type: 'application/octet-stream', data: oversized },
    ], false)

    expect(request.headers.get('content-length')).toBeNull()
    const res = await POST(request)

    expect(res.status).toBe(413)
    expect(received).toHaveLength(0)
  })

  it('returns a clear 400 for a malformed multipart body', async () => {
    const res = await POST(
      new Request(PORTAL_URL, {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=nope' },
        body: 'this is not multipart',
      }),
    )

    expect(res.status).toBe(400)
    expect(((await res.json()) as TryResponse).error).toBeTruthy()
    expect(received).toHaveLength(0)
  })

  it('rejects duplicate controls and files in the @ control namespace', async () => {
    const duplicate = new FormData()
    duplicate.set('@productId', 'prod-1')
    duplicate.set('@method', 'POST')
    duplicate.set('@path', '/upload')
    duplicate.append('@path', '/upload')
    duplicate.append('file', new File([new Uint8Array([1]) as unknown as BlobPart], 'x.bin'))
    expect((await POST(new Request(PORTAL_URL, { method: 'POST', body: duplicate }))).status).toBe(400)

    const fileControl = new FormData()
    fileControl.set('@productId', 'prod-1')
    fileControl.set('@method', 'POST')
    fileControl.set('@path', '/upload')
    fileControl.append('@payload', new File([new Uint8Array([1]) as unknown as BlobPart], 'x.bin'))
    expect((await POST(new Request(PORTAL_URL, { method: 'POST', body: fileControl }))).status).toBe(400)

    expect(received).toHaveLength(0)
  })

  it('rejects multipart for an operation whose spec does not declare multipart', async () => {
    const res = await POST(
      multipartRequest({ ...CONTROLS, '@path': '/json-only' }, [
        { name: 'file', value: new File([new Uint8Array([1, 2, 3]) as unknown as BlobPart], 'x.bin') },
      ]),
    )

    expect(res.status).toBe(400)
    expect(received).toHaveLength(0)
  })

  it('rejects percent-encoded traversal even when the spec template matches', async () => {
    for (const attack of ['/files/%2e%2e', '/files/%2e%2e/health']) {
      received.length = 0
      const res = await POST(
        multipartRequest({ ...CONTROLS, '@path': attack }, [
          { name: 'file', value: new File([new Uint8Array([1]) as unknown as BlobPart], 'x.bin') },
        ]),
      )
      expect(res.status, `attack ${attack}`).toBe(400)
      expect(received, `attack ${attack}`).toHaveLength(0)
    }
  })

  it('allows exactly 3 concurrent uploads and answers the 4th with 429', async () => {
    const jobs = Array.from({ length: 4 }, (_, i) =>
      POST(
        multipartRequest({ ...CONTROLS, '@path': '/slow', note: `n${i}` }, [
          { name: 'file', value: new File([new Uint8Array([i]) as unknown as BlobPart], 'x.bin') },
        ]),
      ),
    )
    const responses = await Promise.all(jobs)
    const statuses = responses.map((res) => res.status).sort((a, b) => a - b)

    expect(statuses).toEqual([200, 200, 200, 429])
    expect(received).toHaveLength(3)
  })

  it('passes an upstream 429 through without turning it into a proxy error', async () => {
    const res = await POST(
      multipartRequest({ ...CONTROLS, '@path': '/rate-limited' }, [
        { name: 'file', value: new File([new Uint8Array([7]) as unknown as BlobPart], 'x.bin') },
      ]),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as TryResponse
    expect(json.status).toBe(429)
    expect(json.body).toContain('rate limited by kong')
  })
})

describe('POST /api/try legacy JSON path', () => {
  it('keeps the 100 KB truncation, forwarded headers and response shape', async () => {
    const res = await POST(
      new Request(PORTAL_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-1',
          method: 'POST',
          path: '/echo',
          apiKey: 'json-key',
          contentType: 'application/json',
          body: 'a'.repeat(MAX_JSON_BODY + 500),
        }),
      }),
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as TryResponse
    expect(json.status).toBe(200)
    expect(received).toHaveLength(1)

    const upstream = received[0]
    expect(upstream.method).toBe('POST')
    expect(upstream.url).toBe('/echo')
    expect(upstream.headers.apikey).toBe('json-key')
    expect(String(upstream.headers['content-type'])).toContain('application/json')
    expect(upstream.raw.length).toBe(MAX_JSON_BODY)

    expect(json.headers?.['ratelimit-limit']).toBe('5')
    expect(json.headers?.['x-kong-response-latency']).toBe('3')
    expect(json.body?.length).toBe(MAX_JSON_BODY)
    expect(typeof json.durationMs).toBe('number')
    expect(json.durationMs).toBeLessThan(15000)
  })
})
