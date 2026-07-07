// Satu-satunya modul yang bicara ke Kong Admin API.
// Semua entity buatan portal diberi tag 'devportal'; modul ini TIDAK PERNAH
// membuat/mengubah service, route, atau plugin milik publisher.

const TAG = 'devportal'

export class KongError extends Error {
  constructor(message: string, public status: number, public body: string) {
    super(message)
  }
}

async function kong<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.KONG_ADMIN_URL
  if (!base) throw new Error('KONG_ADMIN_URL is not set')
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new KongError(`Kong ${init?.method ?? 'GET'} ${path} -> ${res.status}`, res.status, body)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------- consumers ----------

export async function createConsumer(username: string): Promise<{ id: string }> {
  return kong('/consumers', {
    method: 'POST',
    body: JSON.stringify({ username, tags: [TAG] }),
  })
}

export async function deleteConsumer(idOrUsername: string): Promise<void> {
  await kong(`/consumers/${idOrUsername}`, { method: 'DELETE' })
}

// ---------- credentials ----------

export async function createKeyAuth(consumer: string): Promise<{ id: string; key: string }> {
  return kong(`/consumers/${consumer}/key-auth`, {
    method: 'POST',
    body: JSON.stringify({ tags: [TAG] }),
  })
}

export async function deleteKeyAuth(consumer: string, credId: string): Promise<void> {
  await kong(`/consumers/${consumer}/key-auth/${credId}`, { method: 'DELETE' })
}

export async function createJwtCred(consumer: string): Promise<{ id: string; key: string; secret: string }> {
  return kong(`/consumers/${consumer}/jwt`, {
    method: 'POST',
    body: JSON.stringify({ tags: [TAG] }),
  })
}

export async function deleteJwtCred(consumer: string, credId: string): Promise<void> {
  await kong(`/consumers/${consumer}/jwt/${credId}`, { method: 'DELETE' })
}

// ---------- ACL (subscription membership) ----------

export async function addAclGroup(consumer: string, group: string): Promise<{ id: string }> {
  return kong(`/consumers/${consumer}/acls`, {
    method: 'POST',
    body: JSON.stringify({ group, tags: [TAG] }),
  })
}

export async function removeAclGroup(consumer: string, group: string): Promise<void> {
  const { data } = await kong<{ data: { id: string; group: string }[] }>(
    `/consumers/${consumer}/acls?size=1000`,
  )
  const membership = data.find((a) => a.group === group)
  if (membership) await kong(`/consumers/${consumer}/acls/${membership.id}`, { method: 'DELETE' })
}

// ---------- rate limiting per consumer+service (throttling tier) ----------

export type RateLimit = { second?: number; minute?: number; hour?: number; day?: number }

export async function createConsumerRateLimit(
  serviceName: string,
  consumerId: string,
  limits: RateLimit,
): Promise<{ id: string }> {
  const config = Object.fromEntries(
    Object.entries(limits).filter(([, v]) => typeof v === 'number' && v > 0),
  )
  if (Object.keys(config).length === 0) throw new Error(`plan tanpa limit untuk service ${serviceName}`)
  return kong('/plugins', {
    method: 'POST',
    body: JSON.stringify({
      name: 'rate-limiting',
      consumer: { id: consumerId },
      service: { name: serviceName },
      config,
      tags: [TAG],
    }),
  })
}

// Cari plugin rate-limiting milik portal untuk consumer ini (untuk revoke).
export async function findConsumerRateLimits(
  consumerId: string,
): Promise<{ id: string; service?: { id: string } | null }[]> {
  const { data } = await kong<{
    data: { id: string; name: string; tags?: string[]; service?: { id: string } | null }[]
  }>(`/consumers/${consumerId}/plugins?size=1000`)
  return data.filter((p) => p.name === 'rate-limiting' && p.tags?.includes(TAG))
}

export async function getServiceId(name: string): Promise<string> {
  const svc = await kong<{ id: string }>(`/services/${name}`)
  return svc.id
}

export async function deletePlugin(id: string): Promise<void> {
  await kong(`/plugins/${id}`, { method: 'DELETE' })
}

// ---------- setup checklist (read-only, sisi publisher) ----------

export type ServiceCheck = {
  service: string
  exists: boolean
  hasAuth: boolean // key-auth atau jwt terpasang
  hasAcl: boolean
  aclAllowsGroup: boolean
}

export async function checkServiceSetup(serviceName: string, aclGroup: string): Promise<ServiceCheck> {
  const check: ServiceCheck = { service: serviceName, exists: false, hasAuth: false, hasAcl: false, aclAllowsGroup: false }
  try {
    await kong(`/services/${serviceName}`)
    check.exists = true
  } catch {
    return check
  }
  const { data } = await kong<{ data: { name: string; enabled: boolean; config: { allow?: string[] } }[] }>(
    `/services/${serviceName}/plugins?size=1000`,
  )
  const enabled = data.filter((p) => p.enabled)
  check.hasAuth = enabled.some((p) => p.name === 'key-auth' || p.name === 'jwt')
  const acl = enabled.find((p) => p.name === 'acl')
  check.hasAcl = !!acl
  check.aclAllowsGroup = !!acl?.config.allow?.includes(aclGroup)
  return check
}

// ---------- info & discovery (untuk setup check + import katalog) ----------

export type KongInfo = { version: string; availablePlugins: string[] }

export async function getKongInfo(): Promise<KongInfo> {
  const root = await kong<{ version: string; plugins?: { available_on_server?: Record<string, unknown> | string[] } }>('/')
  const avail = root.plugins?.available_on_server
  return {
    version: root.version,
    availablePlugins: Array.isArray(avail) ? avail : Object.keys(avail ?? {}),
  }
}

export async function listServices(): Promise<{ name: string; host: string }[]> {
  const { data } = await kong<{ data: { name: string; host: string }[] }>('/services?size=1000')
  return data
}

export async function listServiceRoutes(serviceName: string): Promise<{ name: string | null; paths: string[] }[]> {
  const { data } = await kong<{ data: { name: string | null; paths: string[] | null }[] }>(
    `/services/${serviceName}/routes?size=1000`,
  )
  return data.map((r) => ({ name: r.name, paths: r.paths ?? [] }))
}

// ---------- blacklist consumer (request-termination per consumer) ----------

export async function blockConsumer(consumerId: string): Promise<{ id: string }> {
  return kong('/plugins', {
    method: 'POST',
    body: JSON.stringify({
      name: 'request-termination',
      consumer: { id: consumerId },
      config: { status_code: 403, message: 'Consumer diblokir oleh portal.' },
      tags: [TAG],
    }),
  })
}

export async function unblockConsumer(consumerId: string): Promise<void> {
  const { data } = await kong<{ data: { id: string; name: string; tags?: string[] }[] }>(
    `/consumers/${consumerId}/plugins?size=1000`,
  )
  for (const p of data.filter((p) => p.name === 'request-termination' && p.tags?.includes(TAG))) {
    await kong(`/plugins/${p.id}`, { method: 'DELETE' })
  }
}

// ---------- prasyarat prometheus (analytics per-consumer) ----------

export type PrometheusPluginState = { exists: boolean; enabled: boolean; perConsumer: boolean; latency: boolean; id?: string }

export async function getGlobalPrometheusPlugin(): Promise<PrometheusPluginState> {
  const { data } = await kong<{
    data: { id: string; name: string; enabled: boolean; consumer: unknown; service: unknown; route: unknown; config: { per_consumer?: boolean; latency_metrics?: boolean } }[]
  }>('/plugins?size=1000')
  const p = data.find((p) => p.name === 'prometheus' && !p.consumer && !p.service && !p.route)
  if (!p) return { exists: false, enabled: false, perConsumer: false, latency: false }
  return { exists: true, enabled: p.enabled, perConsumer: !!p.config.per_consumer, latency: !!p.config.latency_metrics, id: p.id }
}

export async function ensurePrometheusPerConsumer(): Promise<void> {
  const cur = await getGlobalPrometheusPlugin()
  if (!cur.exists) {
    await kong('/plugins', {
      method: 'POST',
      body: JSON.stringify({
        name: 'prometheus',
        config: { status_code_metrics: true, per_consumer: true, latency_metrics: true },
        tags: [TAG],
      }),
    })
    return
  }
  if (!cur.perConsumer || !cur.enabled || !cur.latency) {
    await kong(`/plugins/${cur.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: true, config: { per_consumer: true, status_code_metrics: true, latency_metrics: true } }),
    })
  }
}
