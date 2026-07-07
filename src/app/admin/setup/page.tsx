import { getGlobalPrometheusPlugin, getKongInfo, type KongInfo, type PrometheusPluginState } from '@/lib/kong'
import { fixPrometheusPlugin } from '@/actions/admin-setup'

const REQUIRED_PLUGINS = ['key-auth', 'jwt', 'acl', 'rate-limiting', 'request-termination', 'prometheus']

function Row({ ok, warn, label, detail, children }: {
  ok: boolean; warn?: boolean; label: string; detail?: string; children?: React.ReactNode
}) {
  const icon = ok ? '✓' : warn ? '⚠' : '✗'
  const color = ok ? 'text-go' : warn ? 'text-warn' : 'text-stop'
  return (
    <li className="flex items-start gap-3 border-b py-3">
      <span className={`w-4 font-bold ${color}`}>{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted">{detail}</p>}
      </div>
      {children}
    </li>
  )
}

async function checkPrometheusUrl(): Promise<boolean> {
  if (!process.env.PROMETHEUS_URL) return false
  try {
    const res = await fetch(`${process.env.PROMETHEUS_URL}/-/ready`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

export default async function SetupPage() {
  let info: KongInfo | null = null
  let kongError = ''
  try {
    info = await getKongInfo()
  } catch (e) {
    kongError = e instanceof Error ? e.message : 'unknown'
  }
  let prom: PrometheusPluginState | null = null
  if (info) prom = await getGlobalPrometheusPlugin().catch(() => null)
  const promUrlOk = await checkPrometheusUrl()
  const missingPlugins = info ? REQUIRED_PLUGINS.filter((p) => !info.availablePlugins.includes(p)) : []

  return (
    <main className="max-w-3xl">
      <h1 className="mb-1 text-xl font-bold">Setup & Sanity Check</h1>
      <p className="mb-4 text-sm text-muted">
        Verify connectivity and prerequisites so every portal feature works. Revisit this page after changing configuration.
      </p>
      <ul>
        <Row ok={!!info} label="Kong Admin API reachable"
          detail={info ? `${process.env.KONG_ADMIN_URL} — Kong ${info.version}` : `${process.env.KONG_ADMIN_URL ?? 'KONG_ADMIN_URL is not set'} — ${kongError}`} />
        {info && (
          <Row ok={missingPlugins.length === 0} label="Required plugins available on the Kong server"
            detail={missingPlugins.length === 0
              ? REQUIRED_PLUGINS.join(', ')
              : `Missing: ${missingPlugins.join(', ')} — related features will not work`} />
        )}
        {info && (
          <Row ok={!!prom?.exists && prom.enabled && prom.perConsumer && prom.latency}
            label="Global prometheus plugin enabled (per_consumer + latency_metrics)"
            detail={!prom?.exists ? 'Not installed — per-app analytics will have no data'
              : !prom.perConsumer ? 'Installed but per_consumer=false — metrics lack the consumer label'
              : !prom.latency ? 'Installed but latency_metrics=false — p95 latency unavailable'
              : 'OK — consumer + latency metrics available'}>
            {(!prom?.exists || !prom.perConsumer || !prom.enabled || !prom.latency) && (
              <form action={fixPrometheusPlugin}>
                <button className="btn-primary btn-sm">Fix automatically</button>
              </form>
            )}
          </Row>
        )}
        <Row ok={promUrlOk} warn={!process.env.PROMETHEUS_URL}
          label="Prometheus reachable (analytics)"
          detail={process.env.PROMETHEUS_URL ? `${process.env.PROMETHEUS_URL}` : 'PROMETHEUS_URL is not set — analytics disabled'} />
        <Row ok={!!process.env.SMTP_HOST} warn={!process.env.SMTP_HOST}
          label="SMTP configured"
          detail={process.env.SMTP_HOST ? process.env.SMTP_HOST : 'Not set — verification/reset links only appear in the server log (dev mode)'} />
        <Row ok={!!process.env.KONG_PROXY_URL} warn={!process.env.KONG_PROXY_URL}
          label="Kong proxy URL (catalog import default)"
          detail={process.env.KONG_PROXY_URL ?? 'KONG_PROXY_URL is not set — import defaults to http://localhost:8104'} />
      </ul>
      <p className="mt-4 text-xs text-muted">
        Boundary note: per-service protection (key-auth/jwt + acl) is configured on the publisher side; the portal only verifies it via each API page checklist.
      </p>
    </main>
  )
}
