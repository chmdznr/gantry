import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createConsumerRateLimit, removeAclGroup, KongError } from '../kong'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  process.env.KONG_ADMIN_URL = 'http://kong:8001'
  fetchMock.mockReset()
})

const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json })

describe('createConsumerRateLimit', () => {
  it('kirim hanya limit > 0 dan scoped consumer+service dengan tag devportal', async () => {
    fetchMock.mockResolvedValue(ok({ id: 'p1' }))
    await createConsumerRateLimit('svc-a', 'c1', { minute: 60, hour: 0, day: undefined })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://kong:8001/plugins')
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      name: 'rate-limiting',
      consumer: { id: 'c1' },
      service: { name: 'svc-a' },
      config: { minute: 60 },
      tags: ['devportal'],
    })
  })

  it('menolak plan tanpa limit sama sekali', async () => {
    await expect(createConsumerRateLimit('svc-a', 'c1', {})).rejects.toThrow(/tanpa limit/)
  })
})

describe('removeAclGroup', () => {
  it('mencari membership by group lalu delete', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ data: [{ id: 'a1', group: 'gold' }, { id: 'a2', group: 'silver' }] }))
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
    await removeAclGroup('c1', 'silver')
    expect(fetchMock.mock.calls[1][0]).toBe('http://kong:8001/consumers/c1/acls/a2')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
  })

  it('no-op jika membership tidak ada', async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [] }))
    await removeAclGroup('c1', 'gold')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('error handling', () => {
  it('melempar KongError dengan status dan body', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, text: async () => 'conflict' })
    const { createConsumer } = await import('../kong')
    await expect(createConsumer('app-x')).rejects.toMatchObject({ status: 409, body: 'conflict' })
    await expect(createConsumer('app-x')).rejects.toBeInstanceOf(KongError)
  })
})
