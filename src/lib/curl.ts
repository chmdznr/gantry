// Perintah cURL untuk preview Try It. Murni (tanpa DOM/fetch) supaya bisa
// dites langsung; UI menampilkan dan menyalin string yang sama persis.

export type CurlField = { name: string; value: string }
export type CurlFile = { name: string; filename: string }

export type CurlRequest = {
  baseUrl: string
  method: string
  path: string
  // Dikirim proxy sebagai header `apikey`, bukan query/body.
  apiKey?: string
  headers?: Record<string, string>
  // Body JSON mentah; diabaikan untuk GET/HEAD.
  json?: string
  // Ada = endpoint multipart; curl menyusun boundary sendiri, jadi tanpa
  // header Content-Type.
  multipart?: { fields: CurlField[]; files: CurlFile[] }
}

// Kutip satu argumen POSIX shell: selalu single-quote, `'` di dalam nilai
// menjadi `'\''`. Baris baru dan Unicode dibiarkan apa adanya.
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildCurl(req: CurlRequest): string {
  const method = req.method.toUpperCase()
  // Sama dengan target proxy: buang trailing slash baseUrl lalu tempel path
  // (path sudah membawa query string bila ada).
  const url = req.baseUrl.replace(/\/+$/, '') + req.path
  const lines = [`curl -X ${method} ${shellQuote(url)}`]

  if (req.apiKey) lines.push(`-H ${shellQuote(`apikey: ${req.apiKey}`)}`)
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (!name.trim() || value === '') continue
    lines.push(`-H ${shellQuote(`${name}: ${value}`)}`)
  }

  if (req.multipart) {
    for (const field of req.multipart.fields) {
      if (!field.name.trim() || field.value === '') continue
      lines.push(`-F ${shellQuote(`${field.name}=${field.value}`)}`)
    }
    for (const file of req.multipart.files) {
      lines.push(`-F ${shellQuote(`${file.name}=@${file.filename}`)}`)
    }
  } else if (method !== 'GET' && method !== 'HEAD' && req.json) {
    lines.push(`-H ${shellQuote('Content-Type: application/json')}`)
    lines.push(`--data-raw ${shellQuote(req.json)}`)
  }

  return lines.join(' \\\n  ')
}
