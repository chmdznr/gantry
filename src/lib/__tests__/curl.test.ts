import { describe, expect, it } from 'vitest'
import { buildCurl } from '../curl'

describe('buildCurl', () => {
  it('builds a GET with query and no body', () => {
    expect(buildCurl({
      baseUrl: 'https://gw.kai.id/demo/',
      method: 'get',
      path: '/files?limit=10&q=ayah%20budi',
    })).toBe("curl -X GET 'https://gw.kai.id/demo/files?limit=10&q=ayah%20budi'")
  })

  it('ignores bodies for GET and HEAD', () => {
    expect(buildCurl({
      baseUrl: 'https://gw.kai.id',
      method: 'HEAD',
      path: '/health',
      json: '{"x":1}',
    })).toBe("curl -X HEAD 'https://gw.kai.id/health'")
  })

  it('quotes JSON with apostrophes, newlines and Unicode', () => {
    const body = '{\n  "name": "O\'Neil",\n  "note": "baris dua — ✓"\n}'
    const command = buildCurl({
      baseUrl: 'https://gw.kai.id/api',
      method: 'POST',
      path: '/items',
      apiKey: 'key-123',
      headers: { 'X-Tenant': 'kai' },
      json: body,
    })

    expect(command).toBe(
      "curl -X POST 'https://gw.kai.id/api/items' \\\n" +
      "  -H 'apikey: key-123' \\\n" +
      "  -H 'X-Tenant: kai' \\\n" +
      "  -H 'Content-Type: application/json' \\\n" +
      "  --data-raw '{\n  \"name\": \"O'\\''Neil\",\n  \"note\": \"baris dua — ✓\"\n}'",
    )
  })

  it('includes apikey and filled headers only', () => {
    expect(buildCurl({
      baseUrl: 'https://gw.kai.id',
      method: 'PUT',
      path: '/items/1',
      apiKey: 'secret',
      headers: { 'X-One': '1', 'X-Empty': '', '': 'skip', 'X-Two': 'two' },
    })).toBe([
      "curl -X PUT 'https://gw.kai.id/items/1'",
      "  -H 'apikey: secret'",
      "  -H 'X-One: 1'",
      "  -H 'X-Two: two'",
    ].join(' \\\n'))

    expect(buildCurl({
      baseUrl: 'https://gw.kai.id',
      method: 'GET',
      path: '/ping',
      apiKey: '',
      headers: { 'X-Empty': '' },
    })).toBe("curl -X GET 'https://gw.kai.id/ping'")
  })

  it('uses -F for multipart fields and files without a Content-Type header', () => {
    const command = buildCurl({
      baseUrl: 'https://gw.kai.id/',
      method: 'POST',
      path: '/upload',
      apiKey: 'secret',
      headers: { 'X-Tenant': 'kai' },
      multipart: {
        fields: [
          { name: 'title', value: "it's fine" },
          { name: 'empty', value: '' },
        ],
        files: [
          { name: 'berkas', filename: 'surat satu.pdf' },
          { name: 'berkas', filename: 'lampiran.png' },
        ],
      },
    })

    expect(command).toBe([
      "curl -X POST 'https://gw.kai.id/upload'",
      "  -H 'apikey: secret'",
      "  -H 'X-Tenant: kai'",
      "  -F 'title=it'\\''s fine'",
      "  -F 'berkas=@surat satu.pdf'",
      "  -F 'berkas=@lampiran.png'",
    ].join(' \\\n'))
    expect(command).not.toContain('Content-Type')
  })

  it('joins baseUrl and path with exactly one slash', () => {
    expect(buildCurl({ baseUrl: 'https://gw.kai.id/api/', method: 'GET', path: '/v1/ping' }))
      .toBe("curl -X GET 'https://gw.kai.id/api/v1/ping'")
    expect(buildCurl({ baseUrl: 'https://gw.kai.id/api', method: 'GET', path: '/v1/ping' }))
      .toBe("curl -X GET 'https://gw.kai.id/api/v1/ping'")
  })

  it('shell-escapes apostrophes in URLs and headers', () => {
    expect(buildCurl({
      baseUrl: 'https://gw.kai.id',
      method: 'GET',
      path: "/files?q=O'Neil",
      headers: { 'X-Note': "it's fine" },
    })).toBe([
      "curl -X GET 'https://gw.kai.id/files?q=O'\\''Neil'",
      "  -H 'X-Note: it'\\''s fine'",
    ].join(' \\\n'))
  })
})
