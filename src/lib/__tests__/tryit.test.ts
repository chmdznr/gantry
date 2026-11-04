import { describe, expect, it } from 'vitest'
import {
  TryItError, headerDefaults, jsonExampleBody, parseControlEnvelope, publicBaseUrl, resolveHeaders, samplePath,
  specHeaderParams, textFieldDefault,
} from '../tryit'

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (err) {
    return err instanceof TryItError ? err.code : `unexpected error: ${String(err)}`
  }
  return undefined
}

function controlForm(extra: Record<string, string> = {}) {
  const form = new FormData()
  form.set('@productId', 'prod-1')
  form.set('@method', 'POST')
  form.set('@path', '/upload')
  for (const [name, value] of Object.entries(extra)) form.set(name, value)
  return form
}

describe('specHeaderParams', () => {
  it('merges path-item and operation parameters, header only, skipping $ref', () => {
    const params = specHeaderParams(
      [{ name: 'X-Tenant', in: 'header' }, { $ref: '#/components/parameters/Page' }, { name: 'q', in: 'query' }],
      [{ name: 'X-Trace', in: 'header', required: true }],
    )
    expect(params).toEqual([
      { name: 'X-Tenant', required: false },
      { name: 'X-Trace', required: true },
    ])
  })

  it('is case-insensitive about duplicates and tolerates malformed input', () => {
    expect(specHeaderParams([{ name: 'X-A', in: 'header' }], [{ name: 'x-a', in: 'header' }]))
      .toEqual([{ name: 'X-A', required: false }])
    expect(specHeaderParams(undefined, 'nope', null, [])).toEqual([])
  })
})

describe('resolveHeaders', () => {
  it('passes a spec-declared header (case-insensitive name) and lower-cases it', () => {
    expect(resolveHeaders({ 'X-Tenant': 'acme' }, ['x-tenant'])).toEqual({ 'x-tenant': 'acme' })
  })

  it('always allows Authorization without a spec declaration', () => {
    expect(resolveHeaders({ Authorization: 'Bearer token' }, [])).toEqual({ authorization: 'Bearer token' })
  })

  it('rejects a header the spec does not declare', () => {
    expect(codeOf(() => resolveHeaders({ 'X-Nope': '1' }, ['X-Tenant']))).toBe('headerNotAllowed')
  })

  it('rejects blocklisted headers even when the spec declares them', () => {
    for (const name of ['cookie', 'host', 'apikey', 'x-forwarded-for', 'X-Real-IP', 'Content-Type']) {
      expect(codeOf(() => resolveHeaders({ [name]: 'x' }, [name])), name).toBe('headerNotAllowed')
    }
  })

  it('rejects CRLF and NUL in header values', () => {
    expect(codeOf(() => resolveHeaders({ 'X-Tenant': 'a\r\nX-Evil: 1' }, ['X-Tenant']))).toBe('invalidHeader')
    expect(codeOf(() => resolveHeaders({ 'X-Tenant': 'a\0b' }, ['X-Tenant']))).toBe('invalidHeader')
  })

  it('rejects more than 10 headers', () => {
    const raw = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`X-H${i}`, 'v']))
    expect(codeOf(() => resolveHeaders(raw, Object.keys(raw)))).toBe('invalidHeader')
  })

  it('rejects duplicate names case-insensitively', () => {
    expect(codeOf(() => resolveHeaders({ 'X-Tenant': 'a', 'x-tenant': 'b' }, ['X-Tenant']))).toBe('invalidHeader')
  })

  it('rejects invalid names and non-string values', () => {
    expect(codeOf(() => resolveHeaders({ 'X Tenant': 'a' }, ['X Tenant']))).toBe('invalidHeader')
    expect(codeOf(() => resolveHeaders({ 'X-Tenant': 1 } as unknown as Record<string, string>, ['X-Tenant'])))
      .toBe('invalidHeader')
    expect(codeOf(() => resolveHeaders([['X-Tenant', 'a']], ['X-Tenant']))).toBe('invalidHeader')
  })

  it('drops empty values silently and returns {} when nothing is sent', () => {
    expect(resolveHeaders({ 'X-Tenant': '' }, ['X-Tenant'])).toEqual({})
    expect(resolveHeaders(undefined, [])).toEqual({})
  })
})

describe('parseControlEnvelope @headers', () => {
  it('parses the JSON header map and never exposes it as a form part', () => {
    const envelope = parseControlEnvelope(controlForm({ '@headers': '{"X-Tenant":"acme"}' }))
    expect(envelope.headers).toEqual({ 'X-Tenant': 'acme' })
    expect(envelope.parts).toEqual([])
  })

  it('leaves headers undefined when the control is absent', () => {
    expect(parseControlEnvelope(controlForm()).headers).toBeUndefined()
  })

  it('rejects bad JSON, non-objects and non-string values with invalidControl', () => {
    for (const raw of ['nope', '[]', '"x"', '{"X-Tenant":1}', 'null']) {
      expect(codeOf(() => parseControlEnvelope(controlForm({ '@headers': raw }))), raw).toBe('invalidControl')
    }
  })
})

describe('publicBaseUrl', () => {
  it('uses the public OpenAPI server instead of an internal proxy URL', () => {
    expect(publicBaseUrl({ servers: [{ url: 'https://api-bimtek.arsip.go.id/' }] }, 'http://10.120.1.93:8000'))
      .toBe('https://api-bimtek.arsip.go.id')
  })

  it('falls back when the spec has no usable public server', () => {
    for (const spec of [null, {}, { servers: [] }, { servers: [{ url: '/relative' }] }]) {
      expect(publicBaseUrl(spec, 'http://10.120.1.93:8000')).toBe('http://10.120.1.93:8000')
    }
  })
})

describe('Try It example prefill', () => {
  const pretty = (value: unknown) => JSON.stringify(value, null, 2)

  it('prefers media example, then the first examples value, then schema.example', () => {
    expect(jsonExampleBody({ 'application/json': { example: { from: 'example' } } }))
      .toBe(pretty({ from: 'example' }))
    expect(jsonExampleBody({
      'application/json': {
        examples: { first: { value: { from: 'examples' } }, second: { value: { from: 'second' } } },
        schema: { example: { from: 'schema' } },
      },
    })).toBe(pretty({ from: 'examples' }))
    expect(jsonExampleBody({ 'application/json': { schema: { example: { from: 'schema' } } } }))
      .toBe(pretty({ from: 'schema' }))
  })

  it('accepts vendor +json media and keeps string examples verbatim', () => {
    expect(jsonExampleBody({ 'application/vnd.api+json': { example: { ok: true } } })).toBe(pretty({ ok: true }))
    expect(jsonExampleBody({ 'application/json': { example: '{"raw":true}' } })).toBe('{"raw":true}')
  })

  it('returns an empty body when the spec has no example (never mocks a schema)', () => {
    expect(jsonExampleBody({
      'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } },
    })).toBe('')
    expect(jsonExampleBody(undefined)).toBe('')
  })

  it('blanks nested sensitive values but keeps ordinary fields and shape', () => {
    const body = JSON.parse(jsonExampleBody({
      'application/json': {
        example: {
          username: 'ani',
          password: 'rahasia',
          role_id: 7,
          'token-id': 123,
          profile: { nip: '1987', date: '2026-01-01', client_secret: 's' },
          items: [{ api_key: 'k', keep: 'yes' }],
        },
      },
    }))
    expect(body).toEqual({
      username: 'ani',
      password: '',
      role_id: 7,
      'token-id': '',
      profile: { nip: '1987', date: '2026-01-01', client_secret: '' },
      items: [{ api_key: '', keep: 'yes' }],
    })
  })

  it('prefills multipart text fields from example then default, skipping sensitive ones', () => {
    expect(textFieldDefault('email', { example: 'a@b.c', default: 'x@y.z' })).toBe('a@b.c')
    expect(textFieldDefault('email', { default: 'x@y.z' })).toBe('x@y.z')
    expect(textFieldDefault('retries', { example: 3 })).toBe('3')
    for (const name of ['password', 'access_token', 'apiKey', 'client_secret', 'Authorization']) {
      expect(textFieldDefault(name, { example: 'secret', default: 'secret' }), name).toBeUndefined()
    }
  })

  it('substitutes path examples and appends only query params with an explicit example', () => {
    const pathItem = {
      parameters: [
        { name: 'tenant', in: 'path', example: 'acme' },
        { name: 'limit', in: 'query', example: 5 },
        { name: 'q', in: 'query', example: 'a b&c' },
        { name: 'lang', in: 'query', default: 'id' },
        { name: 'page', in: 'query', required: true },
        { name: 'api_key', in: 'query', example: 'secret' },
      ],
    }
    const operation = { parameters: [{ name: 'tenant', in: 'path', example: 'opco' }] }
    expect(samplePath('/t/{tenant}/items', pathItem, operation)).toBe('/t/opco/items?limit=5&q=a+b%26c')
    expect(samplePath('/x?keep=1', pathItem)).toBe('/x?keep=1&limit=5&q=a+b%26c')
  })

  it('leaves placeholders without an example and never substitutes sensitive path params', () => {
    expect(samplePath('/t/{tenant}/items/{id}', {
      parameters: [{ name: 'tenant', in: 'path', default: 'acme' }],
    })).toBe('/t/acme/items/{id}')
    expect(samplePath('/u/{token}', {
      parameters: [{ name: 'token', in: 'path', example: 'abc' }],
    })).toBe('/u/{token}')
  })

  it('prefills only non-sensitive header examples/defaults', () => {
    expect(headerDefaults(
      { parameters: [{ name: 'Accept', in: 'header', example: 'application/json' }] },
      {
        parameters: [
          { name: 'X-Tenant', in: 'header', default: 'acme' },
          { name: 'X-Required', in: 'header', required: true },
          { name: 'Authorization', in: 'header', example: 'Bearer x' },
          { name: 'token-id', in: 'header', example: 't' },
          { name: 'apikey', in: 'header', example: 'k' },
          { name: 'Content-Type', in: 'header', example: 'application/json' },
        ],
      },
    )).toEqual({ Accept: 'application/json', 'X-Tenant': 'acme' })
  })
})
