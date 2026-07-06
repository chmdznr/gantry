// Query Prometheus untuk analytics per-consumer (label `consumer` = kong_consumer_username app).
// Prasyarat ops: plugin prometheus Kong dengan per_consumer=true.

export type ConsumerStat = { service: string; code: string; count: number }

type PromVector = { data?: { result?: { metric: Record<string, string>; value: [number, string] }[] } }

export async function consumerRequestStats(
  consumerUsername: string,
  range = '24h',
): Promise<ConsumerStat[] | null> {
  const base = process.env.PROMETHEUS_URL
  if (!base) return null // analytics tidak dikonfigurasi
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
