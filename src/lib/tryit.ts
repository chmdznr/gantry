// Kontrak bersama fitur Try It: tipe + helper dipakai route proxy (/api/try)
// dan komponen UI. Jangan duplikasi aturan di sisi route/UI.

export type FormField = {
  name: string
  // binary = properti schema punya `format` (mis. binary/byte) -> input file
  type: 'text' | 'binary'
  required: boolean
  // mis. '$ref not supported in v1' -> field ditampilkan disabled
  unsupported?: string
  // Nilai awal dari `example`/`default` schema; field sensitif tetap kosong.
  defaultValue?: string
}

// Parameter `in: header` dari spec (path-item + operation) yang boleh diisi user.
type HeaderParam = { name: string; required: boolean }

export type TryEndpoint = {
  method: string // key method OpenAPI lowercase, sesuai spec
  path: string // template spec, mis. /files/{id}
  summary?: string
  routable?: boolean
  bodyContentType: 'application/json' | 'multipart/form-data' | 'unsupported'
  formFields: FormField[] // [] untuk endpoint JSON
  headerParams: HeaderParam[] // header yang dideklarasikan spec; Authorization selalu boleh
  // Contoh body JSON dari spec (sudah di-redact); tidak ada bila spec tanpa contoh.
  exampleBody?: string
  // Path yang sudah diisi contoh param path + query; placeholder tanpa contoh tetap.
  samplePath?: string
  // Nilai awal header non-sensitif dari example/default spec.
  headerDefaults?: Record<string, string>
}

export type BodyContentType = TryEndpoint['bodyContentType']

// URL untuk ditampilkan/cURL berasal dari spec publik. proxyBaseUrl di DB bisa
// berupa alamat internal yang hanya dapat dijangkau pod Try It.
export function publicBaseUrl(spec: unknown, fallback: string): string {
  const servers = spec && typeof spec === 'object' && 'servers' in spec ? spec.servers : undefined
  if (!Array.isArray(servers)) return fallback
  for (const entry of servers) {
    const url = entry && typeof entry === 'object' && 'url' in entry ? entry.url : undefined
    if (typeof url === 'string' && /^https?:\/\//.test(url)) return url.replace(/\/+$/, '')
  }
  return fallback
}

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
  // Header tambahan dari kontrol `@headers` (JSON objek string->string).
  headers?: Record<string, string>
  // Field non-kontrol (teks & file) yang boleh diteruskan ke upstream.
  parts: Array<[string, FormDataEntryValue]>
}

const MAX_HEADERS = 10
const MAX_HEADER_NAME = 64
const MAX_HEADER_VALUE = 2048
const HEADER_NAME_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/

// Selalu ditolak walau spec mendeklarasikannya: hop-by-hop / kredensial portal /
// header yang ditentukan isi request itu sendiri.
const FORBIDDEN_HEADERS: Record<string, true> = {
  host: true, 'content-length': true, 'transfer-encoding': true, connection: true, cookie: true,
  'set-cookie': true, 'proxy-authorization': true, upgrade: true, te: true, trailer: true,
  expect: true, 'content-type': true, apikey: true, 'x-real-ip': true, forwarded: true,
}

// Header yang boleh dikirim user = parameter `in: header` dari spec (path-item +
// operation, case-insensitive) plus Authorization. Menerima daftar parameter atau
// objek yang punya `parameters` (path-item/operation); $ref parameter tidak bisa
// di-resolve di sini -> dilewati, bukan error.
export function specHeaderParams(...sources: unknown[]): HeaderParam[] {
  const out: HeaderParam[] = []
  const seen = new Set<string>()
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const list: unknown = Array.isArray(source) ? source : 'parameters' in source ? source.parameters : undefined
    if (!Array.isArray(list)) continue
    for (const param of list) {
      if (!param || typeof param !== 'object' || Array.isArray(param)) continue
      if (!('in' in param) || param.in !== 'header' || !('name' in param)) continue
      const { name } = param
      if (typeof name !== 'string' || !name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name, required: 'required' in param && param.required === true })
    }
  }
  return out
}

// --- Prefill dari contoh OpenAPI -------------------------------------
// Nilai sensitif tidak pernah diisi otomatis: user mengetik kredensial asli.

const SENSITIVE_NAME_PARTS = ['password', 'passwd', 'token', 'authorization', 'apikey', 'secret', 'credential']

// Nama field/param/header mirip kredensial (password, *_token, apiKey, dst).
export function isSensitiveName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return SENSITIVE_NAME_PARTS.some((part) => normalized.includes(part))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function scalarText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

// Ganti nilai string/number sensitif dengan '' tanpa menghapus key-nya.
function redactExample(value: unknown, sensitive: boolean): unknown {
  if (typeof value === 'string' || typeof value === 'number') return sensitive ? '' : value
  if (Array.isArray(value)) return value.map((item) => redactExample(item, sensitive))
  const object = asRecord(value)
  if (!object) return value
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(object)) {
    out[key] = redactExample(item, sensitive || isSensitiveName(key))
  }
  return out
}

// Media type body JSON: application/json, lalu varian `+json` (mis. application/vnd.api+json).
export function jsonMedia(content: unknown): Record<string, unknown> | undefined {
  const entries = Object.entries(asRecord(content) ?? {})
  const entry = entries.find(([type]) => type.toLowerCase() === 'application/json')
    ?? entries.find(([type]) => /^application\/[^;]+\+json$/i.test(type))
  return asRecord(entry?.[1])
}

function firstExampleValue(examples: unknown): unknown {
  for (const entry of Object.values(asRecord(examples) ?? {})) {
    const value = asRecord(entry)?.value
    if (value !== undefined) return value
  }
  return undefined
}

// Contoh body JSON dengan prioritas media.example -> examples.*.value pertama ->
// schema.example. Tidak ada contoh = '' (tidak pernah mengarang body dari schema).
export function jsonExampleBody(content: unknown): string {
  const media = jsonMedia(content)
  if (!media) return ''
  let value = media.example
  if (value === undefined) value = firstExampleValue(media.examples)
  if (value === undefined) value = asRecord(media.schema)?.example
  if (value === undefined) return ''
  const redacted = redactExample(value, false)
  return typeof redacted === 'string' ? redacted : (JSON.stringify(redacted, null, 2) ?? '')
}

// Nilai awal field teks multipart: property.example lalu property.default.
// Field sensitif dan nilai non-skalar tidak diisi.
export function textFieldDefault(name: string, prop: unknown): string | undefined {
  if (isSensitiveName(name)) return undefined
  const schema = asRecord(prop)
  return scalarText(schema?.example) ?? scalarText(schema?.default)
}

type SpecParam = {
  name: string
  in: string
  required: boolean
  example?: unknown
  default?: unknown
  schema?: unknown
}

// Parameter path-item + operation; operation menang untuk (in, name) yang sama.
function mergedParams(sources: unknown[]): SpecParam[] {
  const merged = new Map<string, SpecParam>()
  for (const source of sources) {
    const list = Array.isArray(source) ? source : asRecord(source)?.parameters
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      const param = asRecord(raw)
      if (!param || typeof param.name !== 'string' || typeof param.in !== 'string') continue
      merged.set(`${param.in}:${param.name.toLowerCase()}`, {
        name: param.name,
        in: param.in,
        required: param.required === true,
        ...(param.example !== undefined ? { example: param.example } : {}),
        ...(param.default !== undefined ? { default: param.default } : {}),
        ...(param.schema !== undefined ? { schema: param.schema } : {}),
      })
    }
  }
  return [...merged.values()]
}

function paramExample(param: SpecParam): unknown {
  const schema = asRecord(param.schema)
  for (const value of [param.example, schema?.example, param.default, schema?.default]) {
    if (value !== undefined) return value
  }
  return undefined
}

function paramExplicitExample(param: SpecParam): unknown {
  if (param.example !== undefined) return param.example
  return asRecord(param.schema)?.example
}

// Path siap pakai: `{name}` diganti contoh/default param path (placeholder tanpa
// nilai tetap), lalu query hanya dari param yang punya contoh eksplisit — wajib,
// atau opsional dengan example non-kosong. Nilai di-encode via URLSearchParams.
export function samplePath(path: string, ...sources: unknown[]): string {
  const params = mergedParams(sources)
  const queryIndex = path.indexOf('?')
  const rawPath = queryIndex === -1 ? path : path.slice(0, queryIndex)
  const rawQuery = queryIndex === -1 ? '' : path.slice(queryIndex + 1)

  const filled = rawPath.replace(/\{([^{}]+)\}/g, (placeholder, name: string) => {
    if (isSensitiveName(name)) return placeholder
    const param = params.find((p) => p.in === 'path' && p.name === name)
    const value = param ? scalarText(paramExample(param)) : undefined
    return value ? encodeURIComponent(value) : placeholder
  })

  const query = new URLSearchParams(rawQuery)
  for (const param of params) {
    if (param.in !== 'query' || isSensitiveName(param.name)) continue
    const value = scalarText(paramExample(param))
    if (!value) continue
    if (!param.required && !scalarText(paramExplicitExample(param))) continue
    if (!query.has(param.name)) query.append(param.name, value)
  }
  const search = query.toString()
  return search ? `${filled}?${search}` : filled
}

// Nilai awal header non-sensitif; header yang selalu ditolak proxy tetap kosong.
export function headerDefaults(...sources: unknown[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const param of mergedParams(sources)) {
    if (param.in !== 'header' || isSensitiveName(param.name)) continue
    if (Object.hasOwn(FORBIDDEN_HEADERS, param.name.toLowerCase())) continue
    const value = scalarText(paramExample(param))
    if (!value || /[\r\n\0]/.test(value)) continue
    out[param.name] = value
  }
  return out
}

// Satu-satunya validasi header user (dipakai JSON & multipart): nama harus
// diizinkan server, token RFC, tanpa CR/LF/NUL, maksimum 10, tanpa duplikat
// case-insensitive. Nilai kosong dibuang diam-diam (UI hanya mengirim baris terisi).
export function resolveHeaders(raw: unknown, allowedNames: string[]): Record<string, string> {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TryItError('Format header tidak valid.', 400, 'invalidHeader')
  }
  const entries = Object.entries(raw)
  if (entries.length > MAX_HEADERS) {
    throw new TryItError(`Maksimal ${MAX_HEADERS} header.`, 400, 'invalidHeader')
  }

  const allowed = new Set(['authorization'])
  for (const name of allowedNames) allowed.add(name.toLowerCase())
  const out: Record<string, string> = {}
  const seen = new Set<string>()

  for (const [name, value] of entries) {
    if (
      typeof value !== 'string' ||
      name.length > MAX_HEADER_NAME ||
      !HEADER_NAME_RE.test(name) ||
      value.length > MAX_HEADER_VALUE ||
      /[\r\n\0]/.test(value)
    ) {
      throw new TryItError(`Header tidak valid: ${name}.`, 400, 'invalidHeader')
    }
    const key = name.toLowerCase()
    if (seen.has(key)) throw new TryItError(`Header duplikat: ${name}.`, 400, 'invalidHeader')
    seen.add(key)
    if (value === '') continue
    if (Object.hasOwn(FORBIDDEN_HEADERS, key) || key.startsWith('x-forwarded-') || !allowed.has(key)) {
      throw new TryItError(`Header tidak diizinkan: ${name}.`, 400, 'headerNotAllowed')
    }
    out[key] = value
  }
  return out
}

// `@headers` = JSON objek string->string. JSON rusak / bukan objek / nilai
// non-string = 400 invalidControl (bentuk nama/nilai divalidasi resolveHeaders).
function parseHeaderControl(raw: string | undefined): Record<string, string> | undefined {
  if (raw === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new TryItError('@headers harus JSON objek.', 400, 'invalidControl')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TryItError('@headers harus JSON objek.', 400, 'invalidControl')
  }
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new TryItError('@headers harus berisi string.', 400, 'invalidControl')
    out[name] = value
  }
  return out
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
  const headers = parseHeaderControl(controls.get('@headers'))
  return {
    productId: controls.get('@productId')!,
    method: controls.get('@method')!,
    path: controls.get('@path')!,
    ...(apiKey ? { apiKey } : {}),
    ...(headers ? { headers } : {}),
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
