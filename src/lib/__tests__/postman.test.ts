import { describe, it, expect } from 'vitest'
import { isPostmanCollection, postmanToOpenApi } from '../postman'

const collection = {
  info: {
    name: 'Payment API',
    description: 'Koleksi pembayaran',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: 'Payments',
      item: [
        {
          name: 'Buat pembayaran',
          request: {
            method: 'POST',
            description: 'Membuat transaksi baru',
            url: { raw: '{{baseUrl}}/payments', path: ['payments'] },
            body: { mode: 'raw', raw: '{"amount": 1000, "currency": "IDR"}' },
          },
          response: [
            { name: 'Created', code: 201, body: '{"id": "px-1", "status": "pending"}' },
            { name: 'Invalid', code: 400, body: '{"message": "bad request"}' },
          ],
        },
        {
          name: 'Detail pembayaran',
          request: {
            method: 'GET',
            url: {
              path: ['payments', ':id'],
              query: [{ key: 'expand', value: 'events', description: 'Sertakan riwayat' }, { key: 'off', disabled: true }],
            },
          },
        },
      ],
    },
    {
      name: 'Ping',
      request: { method: 'GET', url: 'https://api.example.com/ping?x=1' },
    },
  ],
}

describe('isPostmanCollection', () => {
  it('deteksi via info.schema', () => {
    expect(isPostmanCollection(collection)).toBe(true)
    expect(isPostmanCollection({ openapi: '3.0.0' })).toBe(false)
    expect(isPostmanCollection(null)).toBe(false)
  })
})

describe('postmanToOpenApi', () => {
  const spec = postmanToOpenApi(collection) as {
    info: { title: string }
    paths: Record<string, Record<string, {
      summary?: string; tags?: string[]
      parameters?: { name: string; in: string; required?: boolean; description?: string }[]
      requestBody?: { content: Record<string, { schema: { example?: unknown } }> }
      responses: Record<string, { description?: string }>
    }>>
  }

  it('judul & path dasar', () => {
    expect(spec.info.title).toBe('Payment API')
    expect(Object.keys(spec.paths).sort()).toEqual(['/payments', '/payments/{id}', '/ping'])
  })

  it('folder jadi tag, body raw jadi contoh requestBody', () => {
    const post = spec.paths['/payments'].post
    expect(post.tags).toEqual(['Payments'])
    expect(post.summary).toBe('Buat pembayaran')
    expect(post.requestBody!.content['application/json'].schema.example).toEqual({ amount: 1000, currency: 'IDR' })
  })

  it('saved responses jadi responses per code', () => {
    const post = spec.paths['/payments'].post
    expect(Object.keys(post.responses).sort()).toEqual(['201', '400'])
    expect(post.responses['201'].description).toBe('Created')
  })

  it(':id jadi path param wajib, query disabled dibuang', () => {
    const get = spec.paths['/payments/{id}'].get
    const names = get.parameters!.map((p) => `${p.in}:${p.name}`)
    expect(names).toEqual(['path:id', 'query:expand'])
    expect(get.parameters![0].required).toBe(true)
  })

  it('url string: host & query dibuang, default 200', () => {
    const get = spec.paths['/ping'].get
    expect(get.responses['200']).toBeDefined()
  })
})
