// Kontrak bersama fitur Try It: tipe + helper dipakai route proxy (/api/try)
// dan komponen UI. Jangan duplikasi aturan di sisi route/UI.

export type FormField = {
  name: string
  // binary = properti schema punya `format` (mis. binary/byte) -> input file
  type: 'text' | 'binary'
  required: boolean
  // mis. '$ref not supported in v1' -> field ditampilkan disabled
  unsupported?: string
}

export type TryEndpoint = {
  method: string // key method OpenAPI lowercase, sesuai spec
  path: string // template spec, mis. /files/{id}
  summary?: string
  routable?: boolean
  bodyContentType: 'application/json' | 'multipart/form-data' | 'unsupported'
  formFields: FormField[] // [] untuk endpoint JSON
}

export type BodyContentType = TryEndpoint['bodyContentType']

export const MAX_JSON_BODY = 100 * 1024 // byte; perilaku lama (truncate, bukan tolak)
export const MAX_MULTIPART_BYTES = 10 * 1024 * 1024 // 10 MB agregat TERMASUK overhead multipart

export class TryItError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'TryItError'
    this.status = status
    this.code = code
  }
}

export type ControlEnvelope = {
  productId: string
  method: string
  path: string
  apiKey?: string
  // Field non-kontrol (teks & file) yang boleh diteruskan ke upstream.
  parts: Array<[string, FormDataEntryValue]>
}

const CONTROL_PREFIX = '@'
const REQUIRED_CONTROLS = ['@productId', '@method', '@path'] as const

// Amplop kontrol multipart: semua kontrol wajib berprefix `@` dan bernilai string.
// Duplikat/nilai non-string (termasuk file bernama `@*`) ditolak 400. Field kontrol
// TIDAK pernah diteruskan ke upstream; apiKey hanya jadi header `apikey` saat fetch.
export function parseControlEnvelope(form: FormData): ControlEnvelope {
  const controls = new Map<string, string>()
  const parts: ControlEnvelope['parts'] = []

  for (const [name, value] of form.entries()) {
    if (name.startsWith(CONTROL_PREFIX)) {
      if (typeof value !== 'string') {
        throw new TryItError(`Field kontrol harus berupa string: ${name}.`, 400, 'invalidControl')
      }
      if (controls.has(name)) {
        throw new TryItError(`Field kontrol duplikat: ${name}.`, 400, 'invalidControl')
      }
      controls.set(name, value)
      continue
    }
    parts.push([name, value])
  }

  for (const key of REQUIRED_CONTROLS) {
    if (!controls.get(key)) throw new TryItError(`Field kontrol wajib: ${key}.`, 400, 'invalidControl')
  }

  const apiKey = controls.get('@apiKey')
  return {
    productId: controls.get('@productId')!,
    method: controls.get('@method')!,
    path: controls.get('@path')!,
    ...(apiKey ? { apiKey } : {}),
    parts,
  }
}

// `%2e`/`%2f`/`%5c` (dan variasi case) di path bisa berubah arti setelah upstream
// men-decode-nya (bypass `/files/%2e%2e`), jadi ditolak sebelum fetch.
const ENCODED_PATH_ESCAPE = /%(?:2e|2f|5c)/i
const DOT_SEGMENT = /(?:^|\/)\.\.?(?:\/|$)/

// Validasi target konkret SETELAH spec-operation match:
// - tidak ada segmen `..`/`.` maupun escape terenkode yang mengubah canonical path
// - origin target sama dengan proxyBaseUrl produk
// - path hasil resolve URL persis sama dengan path yang diminta (bukan hasil normalisasi)
export function assertCanonicalTarget(targetUrl: string, reqPath: string, proxyBaseUrl: string): void {
  const rawPath = reqPath.split('?')[0]
  if (!rawPath.startsWith('/') || rawPath.includes('\\') || ENCODED_PATH_ESCAPE.test(rawPath) || DOT_SEGMENT.test(rawPath)) {
    throw new TryItError('Path tidak valid.', 400, 'invalidPath')
  }

  let target: URL
  let base: URL
  try {
    target = new URL(targetUrl)
    base = new URL(proxyBaseUrl)
  } catch {
    throw new TryItError('Target URL tidak valid.', 400, 'invalidPath')
  }

  if ((target.protocol !== 'http:' && target.protocol !== 'https:') || target.username || target.password || target.origin !== base.origin) {
    throw new TryItError('Target URL tidak valid.', 400, 'invalidPath')
  }

  const basePath = base.pathname.replace(/\/$/, '')
  if (target.pathname !== basePath + rawPath) {
    throw new TryItError('Path tidak valid.', 400, 'invalidPath')
  }
}
