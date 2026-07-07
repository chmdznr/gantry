import Markdown from 'react-markdown'

// Referensi API ala Swagger UI, dirender server-side dari OpenAPI JSON.
// Accordion per operation: deskripsi, parameter, request body, responses.

type Schema = {
  $ref?: string
  type?: string
  format?: string
  enum?: unknown[]
  items?: Schema
  properties?: Record<string, Schema>
  required?: string[]
  example?: unknown
  description?: string
}
type Parameter = { name: string; in: string; required?: boolean; description?: string; schema?: Schema }
type Operation = {
  summary?: string
  description?: string
  deprecated?: boolean
  tags?: string[]
  parameters?: Parameter[]
  requestBody?: { description?: string; content?: Record<string, { schema?: Schema }> }
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: Schema }> }>
}
type Spec = {
  paths?: Record<string, Record<string, Operation> & { parameters?: Parameter[] }>
  components?: { schemas?: Record<string, Schema> }
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const
const methodBadge: Record<string, string> = {
  GET: 'bg-go-soft text-go',
  POST: 'bg-ink text-paper',
  PUT: 'bg-warn-soft text-warn',
  PATCH: 'bg-warn-soft text-warn',
  DELETE: 'bg-stop-soft text-stop',
  HEAD: 'bg-line/60 text-ink-soft',
  OPTIONS: 'bg-line/60 text-ink-soft',
}

function resolve(schema: Schema | undefined, defs: Record<string, Schema>, depth = 0): Schema | undefined {
  if (!schema || depth > 6) return schema
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() ?? ''
    return resolve(defs[name], defs, depth + 1) ?? schema
  }
  return schema
}

// Bangun contoh JSON dari schema — cukup untuk orientasi, bukan validator.
function sample(schema: Schema | undefined, defs: Record<string, Schema>, depth = 0): unknown {
  const s = resolve(schema, defs, depth)
  if (!s || depth > 4) return null
  if (s.example !== undefined) return s.example
  if (s.enum?.length) return s.enum[0]
  switch (s.type) {
    case 'object': {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(s.properties ?? {})) out[k] = sample(v, defs, depth + 1)
      return out
    }
    case 'array': return [sample(s.items, defs, depth + 1)]
    case 'integer': case 'number': return 0
    case 'boolean': return true
    default: return s.format ? `(${s.format})` : 'string'
  }
}

function typeLabel(schema: Schema | undefined, defs: Record<string, Schema>): string {
  const s = resolve(schema, defs)
  if (!s) return '-'
  if (s.enum?.length) return `enum: ${s.enum.join(' | ')}`
  if (s.type === 'array') return `array<${typeLabel(s.items, defs)}>`
  return s.format ? `${s.type} (${s.format})` : (s.type ?? 'object')
}

function SchemaBlock({ title, schema, defs }: { title: string; schema?: Schema; defs: Record<string, Schema> }) {
  if (!schema) return null
  return (
    <div className="mt-3">
      <p className="label">{title}</p>
      <pre className="overflow-auto rounded-lg bg-ink/5 p-3 font-mono text-xs leading-relaxed">
        {JSON.stringify(sample(schema, defs), null, 2)}
      </pre>
    </div>
  )
}

export default function ApiReference({ spec }: { spec: Spec }) {
  const defs = spec.components?.schemas ?? {}
  const groups = new Map<string, { method: string; path: string; op: Operation; shared: Parameter[] }[]>()

  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const shared = (item.parameters ?? []) as Parameter[]
    for (const m of METHODS) {
      const op = item[m] as Operation | undefined
      if (!op) continue
      const tag = op.tags?.[0] ?? 'Endpoints'
      if (!groups.has(tag)) groups.set(tag, [])
      groups.get(tag)!.push({ method: m.toUpperCase(), path, op, shared })
    }
  }
  if (groups.size === 0) return <p className="text-sm text-muted">Spec tidak memuat endpoint.</p>

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([tag, ops]) => (
        <div key={tag}>
          {groups.size > 1 && <h3 className="mb-2 font-bold">{tag}</h3>}
          <div className="space-y-2">
            {ops.map(({ method, path, op, shared }) => {
              const params = [...shared, ...(op.parameters ?? [])]
              const bodySchema = op.requestBody?.content
                ? Object.values(op.requestBody.content)[0]?.schema : undefined
              return (
                <details key={method + path} className="group rounded-xl border border-line bg-surface">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <span className={`w-16 rounded-md py-1 text-center font-mono text-xs font-bold ${methodBadge[method]}`}>{method}</span>
                    <code className="font-mono text-sm">{path}</code>
                    <span className="text-sm text-muted">{op.summary}</span>
                    {op.deprecated && <span className="badge-warn">deprecated</span>}
                    <span className="ml-auto text-muted transition-transform group-open:rotate-90" aria-hidden>›</span>
                  </summary>
                  <div className="border-t border-line px-4 py-4">
                    {op.description && (
                      <div className="prose prose-sm mb-3 max-w-none text-ink-soft"><Markdown>{op.description}</Markdown></div>
                    )}
                    {params.length > 0 && (
                      <>
                        <p className="label">Parameter</p>
                        <table className="table-base mb-1">
                          <thead><tr><th>Nama</th><th>Letak</th><th>Tipe</th><th>Wajib</th><th>Deskripsi</th></tr></thead>
                          <tbody>
                            {params.map((p) => (
                              <tr key={p.in + p.name}>
                                <td className="font-mono text-xs">{p.name}</td>
                                <td className="text-xs text-muted">{p.in}</td>
                                <td className="font-mono text-xs">{typeLabel(p.schema, defs)}</td>
                                <td>{p.required ? <span className="text-stop">ya</span> : 'tidak'}</td>
                                <td className="text-muted">{p.description ?? ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    <SchemaBlock title="Request body (contoh)" schema={bodySchema} defs={defs} />
                    {op.responses && (
                      <div className="mt-3">
                        <p className="label">Responses</p>
                        <div className="space-y-2">
                          {Object.entries(op.responses).map(([code, r]) => {
                            const rSchema = r.content ? Object.values(r.content)[0]?.schema : undefined
                            const color = code.startsWith('2') ? 'badge-go' : code.startsWith('4') || code.startsWith('5') ? 'badge-stop' : 'badge-muted'
                            return (
                              <details key={code} className="rounded-lg border border-line/70">
                                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                                  <span className={color}>{code}</span>
                                  <span className="text-muted">{r.description}</span>
                                  {rSchema && <span className="ml-auto font-mono text-xs text-muted">skema ›</span>}
                                </summary>
                                {rSchema && (
                                  <pre className="overflow-auto border-t border-line/70 bg-ink/5 p-3 font-mono text-xs leading-relaxed">
                                    {JSON.stringify(sample(rSchema, defs), null, 2)}
                                  </pre>
                                )}
                              </details>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
