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
        Verifikasi koneksi dan prasyarat supaya seluruh fitur portal berfungsi. Jalankan ulang halaman ini setelah mengubah konfigurasi.
      </p>
      <ul>
        <Row ok={!!info} label="Kong Admin API terjangkau"
          detail={info ? `${process.env.KONG_ADMIN_URL} — Kong ${info.version}` : `${process.env.KONG_ADMIN_URL ?? 'KONG_ADMIN_URL belum diset'} — ${kongError}`} />
        {info && (
          <Row ok={missingPlugins.length === 0} label="Plugin yang dibutuhkan tersedia di server Kong"
            detail={missingPlugins.length === 0
              ? REQUIRED_PLUGINS.join(', ')
              : `Tidak tersedia: ${missingPlugins.join(', ')} — fitur terkait tidak akan jalan`} />
        )}
        {info && (
          <Row ok={!!prom?.exists && prom.enabled && prom.perConsumer && prom.latency}
            label="Plugin prometheus global aktif (per_consumer + latency_metrics)"
            detail={!prom?.exists ? 'Belum terpasang — analytics per-app tidak akan ada datanya'
              : !prom.perConsumer ? 'Terpasang tapi per_consumer=false — metrik tidak berlabel consumer'
              : !prom.latency ? 'Terpasang tapi latency_metrics=false — p95 latency tidak tersedia'
              : 'OK — metrik consumer + latency tersedia'}>
            {(!prom?.exists || !prom.perConsumer || !prom.enabled || !prom.latency) && (
              <form action={fixPrometheusPlugin}>
                <button className="btn-primary btn-sm">Perbaiki otomatis</button>
              </form>
            )}
          </Row>
        )}
        <Row ok={promUrlOk} warn={!process.env.PROMETHEUS_URL}
          label="Prometheus terjangkau (analytics)"
          detail={process.env.PROMETHEUS_URL ? `${process.env.PROMETHEUS_URL}` : 'PROMETHEUS_URL belum diset — analytics dinonaktifkan'} />
        <Row ok={!!process.env.SMTP_HOST} warn={!process.env.SMTP_HOST}
          label="SMTP terkonfigurasi"
          detail={process.env.SMTP_HOST ? process.env.SMTP_HOST : 'Belum diset — link verifikasi/reset hanya tampil di log server (mode dev)'} />
        <Row ok={!!process.env.KONG_PROXY_URL} warn={!process.env.KONG_PROXY_URL}
          label="Kong proxy URL (default import katalog)"
          detail={process.env.KONG_PROXY_URL ?? 'KONG_PROXY_URL belum diset — import memakai http://localhost:8104'} />
      </ul>
      <p className="mt-4 text-xs text-muted">
        Catatan boundary: proteksi per-service (key-auth/jwt + acl) dikonfigurasi dari sisi publisher; portal hanya memverifikasi lewat checklist di halaman tiap API.
      </p>
    </main>
  )
}
