// Cek apakah endpoint di spec benar-benar bisa di-route oleh gateway,
// dihitung dari route Kong (sumber kebenaran) — bukan penandaan manual.

export type GatewayRoute = { paths: string[]; methods: string[] | null }

// ponytail: heuristik prefix-match ala Kong (plain prefix, tanpa host/header rules).
// Konservatif ke arah "routable" supaya tidak pernah memblokir endpoint yang sebenarnya jalan:
// route regex (~) dan route tanpa path dianggap match.
export function isEndpointRoutable(specPath: string, method: string, routes: GatewayRoute[]): boolean {
  const concrete = specPath.replace(/\{[^}]+\}/g, 'x') // /payments/{id} -> /payments/x
  const m = method.toUpperCase()
  return routes.some((r) => {
    if (r.methods && r.methods.length > 0 && !r.methods.includes(m)) return false
    if (r.paths.length === 0) return true
    return r.paths.some((p) => p.startsWith('~') || concrete === p || concrete.startsWith(p))
  })
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

// Apakah request (method + concrete path) cocok dengan operasi yang TERDOKUMENTASI di spec.
// Beda dari isEndpointRoutable (prefix Kong): ini exact-per-segmen dengan templating {id},
// supaya user tidak bisa probing path yang tidak terdaftar (mis. /payments/1/secret).
export function matchesSpecOperation(reqPath: string, method: string, specPaths: Record<string, Record<string, unknown>>): boolean {
  return findSpecOperation(reqPath, method, specPaths) !== undefined
}

// Operasi OpenAPI yang cocok (bukan hanya boolean) — dipakai guard requestBody
// multipart. Path item yang malformed tetap dianggap cocok (objek kosong), sama
// dengan perilaku matchesSpecOperation sebelumnya.
export function findSpecOperation(
  reqPath: string,
  method: string,
  specPaths: Record<string, Record<string, unknown>>,
): Record<string, unknown> | undefined {
  return findSpecOperationMatch(reqPath, method, specPaths)?.operation
}

// Sama seperti findSpecOperation, tapi juga mengembalikan path-item-nya supaya
// parameter level path (mis. header) bisa dibaca tanpa menebak template.
export function findSpecOperationMatch(
  reqPath: string,
  method: string,
  specPaths: Record<string, Record<string, unknown>>,
): { pathItem: Record<string, unknown>; operation: Record<string, unknown> } | undefined {
  const m = method.toLowerCase()
  const reqSegs = reqPath.split('?')[0].split('/').filter(Boolean)
  for (const [tmpl, ops] of Object.entries(specPaths)) {
    const entry = Object.entries(ops).find(([k]) => k.toLowerCase() === m && HTTP_METHODS.includes(k.toLowerCase()))
    if (!entry) continue
    const tmplSegs = tmpl.split('/').filter(Boolean)
    if (tmplSegs.length !== reqSegs.length) continue
    const ok = tmplSegs.every((seg, i) =>
      seg.startsWith('{') && seg.endsWith('}') ? reqSegs[i].length > 0 : seg === reqSegs[i])
    if (ok) {
      return {
        pathItem: ops,
        operation: (entry[1] && typeof entry[1] === 'object' ? entry[1] : {}) as Record<string, unknown>,
      }
    }
  }
  return undefined
}
