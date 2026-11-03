import type { ZodType } from 'zod'

// Envelope Admin API: sukses { data }, gagal { error: { code, message, details? } }.
// Semua response no-store karena berisi data admin.
export type AdminApiErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'rate_limited'
  | 'internal_error'

// Batas default untuk body JSON biasa. Endpoint yang menerima OpenAPI spec besar
// boleh menaikkannya lewat opsi maxBytes (maksimum produk 5 MB).
export const DEFAULT_MAX_JSON_BYTES = 1_000_000
export const ADMIN_API_MAX_JSON_BYTES = 5 * 1024 * 1024

function baseHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init)
  headers.set('cache-control', 'no-store')
  return headers
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { ...init, headers: baseHeaders(init?.headers) })
}

export function jsonError(
  status: number,
  code: AdminApiErrorCode,
  message: string,
  options: { details?: unknown; headers?: HeadersInit } = {},
): Response {
  return Response.json(
    { error: { code, message, ...(options.details === undefined ? {} : { details: options.details }) } },
    { status, headers: baseHeaders(options.headers) },
  )
}

export function badRequest(message = 'Invalid request.', details?: unknown): Response {
  return jsonError(400, 'validation_error', message, { details })
}

export function unauthorized(message = 'A valid bearer token is required.'): Response {
  return jsonError(401, 'unauthorized', message, { headers: { 'www-authenticate': 'Bearer' } })
}

export function forbidden(message = 'This credential is not allowed to perform this action.'): Response {
  return jsonError(403, 'forbidden', message)
}

export function notFound(message = 'Resource not found.'): Response {
  return jsonError(404, 'not_found', message)
}

export function conflict(message = 'The resource already exists or conflicts with its current state.'): Response {
  return jsonError(409, 'conflict', message)
}

export function payloadTooLarge(message = 'Request body is too large.'): Response {
  return jsonError(413, 'payload_too_large', message)
}

export function tooManyRequests(message = 'Too many requests for this token.'): Response {
  return jsonError(429, 'rate_limited', message, { headers: { 'retry-after': '60' } })
}

export function serverError(message = 'Internal server error.'): Response {
  return jsonError(500, 'internal_error', message)
}

export type JsonBodyResult<T> = { ok: true; data: T } | { ok: false; response: Response }

// Validasi body JSON + guard ukuran. Content-Length dicek lebih dulu supaya body
// besar ditolak tanpa dibaca; panjang byte aktual dicek lagi untuk chunked request.
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>,
  options: { maxBytes?: number } = {},
): Promise<JsonBodyResult<T>> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: payloadTooLarge(`Request body exceeds ${maxBytes} bytes.`) }
  }

  const raw = await req.text()
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return { ok: false, response: payloadTooLarge(`Request body exceeds ${maxBytes} bytes.`) }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, response: badRequest('Request body must be valid JSON.') }
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      response: badRequest('Request body failed validation.', {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    }
  }
  return { ok: true, data: result.data }
}
