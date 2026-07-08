import { isPostmanCollection, postmanToOpenApi } from '@/lib/postman'

// Parse teks spec dari editor: JSON wajib valid, Postman Collection v2
// dikonversi otomatis (konsisten dengan upload path), dan hasil akhirnya
// wajib punya `paths` object supaya ApiReference bisa merender.
export function parseSpecText(text: string): { error?: string; spec?: unknown } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { error: `JSON tidak valid: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (isPostmanCollection(parsed)) parsed = postmanToOpenApi(parsed)
  const paths = (parsed as { paths?: unknown } | null)?.paths
  if (typeof parsed !== 'object' || parsed === null || typeof paths !== 'object' || paths === null) {
    return { error: 'Spec harus object OpenAPI dengan properti "paths".' }
  }
  return { spec: parsed }
}

// jsonb Postgres tidak mempertahankan urutan key, jadi perbandingan
// harus key-order-insensitive.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function specsEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}
