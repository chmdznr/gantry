import Redis from 'ioredis'

// Klien tunggal, lazy. Null kalau REDIS_URL tidak diset (mode single-instance in-memory).
let client: Redis | null | undefined

export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const url = process.env.REDIS_URL
  if (!url) {
    client = null
    return null
  }
  // offline queue ON: perintah menunggu koneksi siap (perintah pertama tidak
  // langsung gagal); maxRetriesPerRequest 1 supaya cepat menyerah saat Redis down
  client = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000 })
  client.on('error', (e) => console.error('[redis]', e.message))
  return client
}
