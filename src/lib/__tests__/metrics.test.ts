import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import {
  allConsumersUsage,
  consumerBandwidthStats,
  consumerRequestStats,
  serviceLatencyP95,
} from '../metrics'

async function listen(server: Server): Promise<AddressInfo> {
  const listening = Promise.withResolvers<void>()
  server.listen(0, '127.0.0.1', listening.resolve)
  await listening.promise
  return server.address() as AddressInfo
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections()
  const closed = Promise.withResolvers<void>()
  server.close(() => closed.resolve())
  await closed.promise
}

describe('timeout', () => {
  afterEach(() => {
    delete process.env.PROMETHEUS_URL
  })

  it('semua query resolve null saat Prometheus menerima koneksi tapi tidak pernah membalas', async () => {
    const server = createServer(() => {}) // respons tidak pernah dikirim
    const { port } = await listen(server)
    process.env.PROMETHEUS_URL = `http://127.0.0.1:${port}`
    const started = Date.now()
    try {
      const results = await Promise.all([
        consumerRequestStats('app-123'),
        allConsumersUsage(),
        consumerBandwidthStats('app-123'),
        serviceLatencyP95(['svc-a']),
      ])
      expect(results).toEqual([null, null, null, null])
      // Tanpa batas 3 detik, query akan menggantung sampai batas lama 10 detik.
      expect(Date.now() - started).toBeLessThan(5000)
    } finally {
      await close(server)
    }
  }, 10_000)

  it('null instan tanpa PROMETHEUS_URL', async () => {
    await expect(consumerRequestStats('app-123')).resolves.toBeNull()
  })
})
