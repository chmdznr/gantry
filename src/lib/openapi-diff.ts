// Diff endpoint antar dua OpenAPI spec. Endpoint = "METHOD /path".
// "changed" = operation object berbeda (summary/params/response berubah).

export type EndpointDiff = { added: string[]; removed: string[]; changed: string[] }

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'])

function flatten(spec: unknown): Map<string, string> {
  const m = new Map<string, string>()
  const paths = (spec as { paths?: Record<string, Record<string, unknown>> })?.paths
  if (!paths || typeof paths !== 'object') return m
  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue
      m.set(`${method.toUpperCase()} ${path}`, JSON.stringify(op))
    }
  }
  return m
}

export function diffEndpoints(oldSpec: unknown, newSpec: unknown): EndpointDiff {
  const oldOps = flatten(oldSpec)
  const newOps = flatten(newSpec)
  const added = [...newOps.keys()].filter((k) => !oldOps.has(k))
  const removed = [...oldOps.keys()].filter((k) => !newOps.has(k))
  const changed = [...newOps.keys()].filter((k) => oldOps.has(k) && oldOps.get(k) !== newOps.get(k))
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() }
}

export function isEmptyDiff(d: EndpointDiff): boolean {
  return d.added.length === 0 && d.removed.length === 0 && d.changed.length === 0
}

// Perubahan breaking = ada endpoint yang hilang (removed). Untuk highlight, bukan blokir.
export function hasBreakingChange(d: EndpointDiff): boolean {
  return d.removed.length > 0
}
