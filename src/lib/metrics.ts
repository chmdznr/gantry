// Query Prometheus untuk analytics per-consumer (label `consumer` = kong_consumer_username app).
// Prasyarat ops: plugin prometheus Kong dengan per_consumer=true.

export type ConsumerStat = { service: string; code: string; count: number }

export type ConsumerBandwidth = { service: string; type: string; bytes: number }

type PromVector = { data?: { result?: { metric: Record<string, string>; value: [number, string] }[] } }

export async function consumerRequestStats(
  consumerUsername: string,
  range = '24h',
): Promise<ConsumerStat[] | null> {
  const base = process.env.PROMETHEUS_URL
  if (!base) return null // analytics tidak dikonfigurasi
  // guard injeksi PromQL: username selalu `app-<uuid>` buatan portal, tapi jangan percaya pemanggil
  if (!/^[A-Za-z0-9_-]+$/.test(consumerUsername) || !/^[0-9]+[smhd]$/.test(range)) return null
  const q = `sum by (service, code) (increase(kong_http_requests_total{consumer="${consumerUsername}"}[${range}]))`
  try {
    const res = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(q)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as PromVector
    return (json.data?.result ?? [])
      .map((r) => ({
        service: r.metric.service ?? '?',
        code: r.metric.code ?? '?',
        count: Math.round(Number(r.value[1])),
      }))
      .filter((s) => s.count > 0)
      .sort((a, b) => a.service.localeCompare(b.service) || a.code.localeCompare(b.code))
  } catch {
    return null
  }
}

export type AllConsumersUsage = {
  requests: (ConsumerStat & { consumer: string })[]
  bandwidth: (ConsumerBandwidth & { consumer: string })[]
}

// Breakdown per consumer untuk SEMUA consumer sekaligus — 2 query Prometheus berapa pun jumlah barisnya.
export async function allConsumersUsage(range = '24h'): Promise<AllConsumersUsage | null> {
  const base = process.env.PROMETHEUS_URL
  if (!base) return null
  if (!/^[0-9]+[smhd]$/.test(range)) return null
  const query = async (q: string) => {
    const res = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(q)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`prometheus ${res.status}`)
    return ((await res.json()) as PromVector).data?.result ?? []
  }
  try {
    const [req, bw] = await Promise.all([
      query(`sum by (consumer, service, code) (increase(kong_http_requests_total[${range}]))`),
      query(`sum by (consumer, service, type) (increase(kong_bandwidth_bytes[${range}]))`),
    ])
    return {
      requests: req
        .map((r) => ({
          consumer: r.metric.consumer ?? '?',
          service: r.metric.service ?? '?',
          code: r.metric.code ?? '?',
          count: Math.round(Number(r.value[1])),
        }))
        .filter((s) => s.count > 0)
        .sort((a, b) => a.service.localeCompare(b.service) || a.code.localeCompare(b.code)),
      bandwidth: bw
        .map((r) => ({
          consumer: r.metric.consumer ?? '?',
          service: r.metric.service ?? '?',
          type: r.metric.type ?? '?',
          bytes: Math.round(Number(r.value[1])),
        }))
        .filter((s) => s.bytes > 0)
        .sort((a, b) => a.service.localeCompare(b.service) || a.type.localeCompare(b.type)),
    }
  } catch {
    return null
  }
}

export async function consumerBandwidthStats(
  consumerUsername: string,
  range = '24h',
): Promise<ConsumerBandwidth[] | null> {
  const base = process.env.PROMETHEUS_URL
  if (!base) return null
  if (!/^[A-Za-z0-9_-]+$/.test(consumerUsername) || !/^[0-9]+[smhd]$/.test(range)) return null
  const q = `sum by (service, type) (increase(kong_bandwidth_bytes{consumer="${consumerUsername}"}[${range}]))`
  try {
    const res = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(q)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as PromVector
    return (json.data?.result ?? [])
      .map((r) => ({
        service: r.metric.service ?? '?',
        type: r.metric.type ?? '?',
        bytes: Math.round(Number(r.value[1])),
      }))
      .filter((s) => s.bytes > 0)
      .sort((a, b) => a.service.localeCompare(b.service) || a.type.localeCompare(b.type))
  } catch {
    return null
  }
}

export type ServiceLatency = { service: string; p95Ms: number }

// p95 latency per Kong service (agregat, bukan per consumer — Kong tidak melabeli latency dengan consumer).
export async function serviceLatencyP95(serviceNames: string[], range = '24h'): Promise<ServiceLatency[] | null> {
  const base = process.env.PROMETHEUS_URL
  if (!base) return null
  const safe = serviceNames.filter((s) => /^[A-Za-z0-9._-]+$/.test(s))
  if (safe.length === 0 || !/^[0-9]+[smhd]$/.test(range)) return null
  const q = `histogram_quantile(0.95, sum by (le, service) (rate(kong_request_latency_ms_bucket{service=~"${safe.join('|')}"}[${range}])))`
  try {
    const res = await fetch(`${base}/api/v1/query?query=${encodeURIComponent(q)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as PromVector
    return (json.data?.result ?? [])
      .map((r) => ({ service: r.metric.service ?? '?', p95Ms: Math.round(Number(r.value[1])) }))
      .filter((s) => Number.isFinite(s.p95Ms))
  } catch {
    return null
  }
}
