// Konversi Postman Collection v2.x -> OpenAPI 3.0 (dokumentasi).
// Cakupan: folder->tag, method+path, path variable (:id / {{id}}), query param,
// deskripsi, body raw JSON -> contoh requestBody, saved responses -> responses.

type PmUrl = string | {
  raw?: string
  path?: (string | { value?: string })[]
  query?: { key?: string; value?: string; description?: string; disabled?: boolean }[]
  variable?: { key?: string; description?: string }[]
}
type PmRequest = {
  method?: string
  description?: string | { content?: string }
  url?: PmUrl
  body?: { mode?: string; raw?: string }
}
type PmResponse = { name?: string; code?: number; body?: string }
type PmItem = { name?: string; description?: string | { content?: string }; request?: PmRequest; response?: PmResponse[]; item?: PmItem[] }
export type PmCollection = { info?: { name?: string; description?: string | { content?: string }; schema?: string }; item?: PmItem[] }

export function isPostmanCollection(x: unknown): x is PmCollection {
  const schema = (x as PmCollection)?.info?.schema
  return typeof schema === 'string' && schema.includes('getpostman.com/json/collection')
}

function desc(d?: string | { content?: string }): string | undefined {
  if (!d) return undefined
  return typeof d === 'string' ? d : d.content
}

function tryJson(raw?: string): unknown {
  if (!raw?.trim()) return undefined
  try { return JSON.parse(raw) } catch { return undefined }
}

// segmen ':id' atau '{{id}}' -> '{id}'; kumpulkan nama path param
function normalizePath(segments: string[]): { path: string; params: string[] } {
  const params: string[] = []
  const parts = segments.filter(Boolean).map((seg) => {
    const colon = seg.match(/^:(\w+)$/)
    const stache = seg.match(/^\{\{(\w+)\}\}$/)
    const name = colon?.[1] ?? stache?.[1]
    if (name) { params.push(name); return `{${name}}` }
    return seg
  })
  return { path: '/' + parts.join('/'), params }
}

function parseUrl(url?: PmUrl): { path: string; params: string[]; query: { key: string; description?: string }[] } {
  if (!url) return { path: '/', params: [], query: [] }
  if (typeof url === 'string') {
    // buang protocol+host & {{baseUrl}}; ambil path saja
    const noVar = url.replace(/^\{\{[^}]+\}\}/, '')
    const noProto = noVar.replace(/^https?:\/\/[^/]+/, '')
    const clean = noProto.split('?')[0]
    return { ...normalizePath(clean.split('/')), query: [] }
  }
  const segs = (url.path ?? []).map((p) => (typeof p === 'string' ? p : p.value ?? ''))
  const { path, params } = normalizePath(segs)
  const query = (url.query ?? [])
    .filter((q) => q.key && !q.disabled)
    .map((q) => ({ key: q.key!, description: q.description }))
  return { path, params, query }
}

type OpenApiOp = Record<string, unknown>

function walk(items: PmItem[], tag: string | undefined, paths: Record<string, Record<string, OpenApiOp>>) {
  for (const item of items) {
    if (item.item) { // folder -> tag (pakai nama folder terluar saja)
      walk(item.item, tag ?? item.name, paths)
      continue
    }
    const req = item.request
    if (!req?.method) continue
    const { path, params, query } = parseUrl(req.url)
    const method = req.method.toLowerCase()

    const parameters = [
      ...params.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
      ...query.map((q) => ({ name: q.key, in: 'query', description: q.description, schema: { type: 'string' } })),
    ]
    const bodyExample = req.body?.mode === 'raw' ? tryJson(req.body.raw) : undefined

    const responses: Record<string, unknown> = {}
    for (const r of item.response ?? []) {
      const code = String(r.code ?? 200)
      if (responses[code]) continue
      const example = tryJson(r.body)
      responses[code] = {
        description: r.name ?? '',
        ...(example !== undefined ? { content: { 'application/json': { schema: { type: 'object', example } } } } : {}),
      }
    }
    if (Object.keys(responses).length === 0) responses['200'] = { description: 'OK' }

    const op: OpenApiOp = {
      summary: item.name,
      ...(desc(item.description) || desc(req.description) ? { description: desc(item.description) ?? desc(req.description) } : {}),
      ...(tag ? { tags: [tag] } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(bodyExample !== undefined
        ? { requestBody: { content: { 'application/json': { schema: { type: 'object', example: bodyExample } } } } }
        : {}),
      responses,
    }
    paths[path] ??= {}
    paths[path][method] = op
  }
}

export function postmanToOpenApi(col: PmCollection): Record<string, unknown> {
  const paths: Record<string, Record<string, OpenApiOp>> = {}
  walk(col.item ?? [], undefined, paths)
  return {
    openapi: '3.0.0',
    info: {
      title: col.info?.name ?? 'Imported API',
      ...(desc(col.info?.description) ? { description: desc(col.info?.description) } : {}),
      version: '1.0.0',
    },
    paths,
  }
}
