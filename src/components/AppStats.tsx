import { getTranslations } from 'next-intl/server'
import { consumerBandwidthStats, consumerRequestStats } from '@/lib/metrics'
import { RANGES } from '@/lib/ranges'
import { RangeSelector } from './RangeSelector'

// warna via token theme (bg-go/warn/stop), bukan palet Tailwind mentah — ikut ganti saat theme berubah
const codeTone = (code: string) =>
  code.startsWith('2') ? { bar: 'bg-go', badge: 'badge-go' }
  : code.startsWith('4') ? { bar: 'bg-warn', badge: 'badge-warn' }
  : { bar: 'bg-stop', badge: 'badge-stop' }

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

function Bar({ ratio, tone }: { ratio: number; tone: string }) {
  return (
    <div className="h-2 w-full max-w-64 overflow-hidden rounded-full bg-ink/10">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
    </div>
  )
}

export default async function AppStats({ consumerUsername, range = '24h' }: { consumerUsername: string; range?: string }) {
  const t = await getTranslations('apps')
  const safeRange = (RANGES as readonly string[]).includes(range) ? range : '24h'
  const [stats, bw] = await Promise.all([
    consumerRequestStats(consumerUsername, safeRange),
    consumerBandwidthStats(consumerUsername, safeRange),
  ])
  if (stats === null && bw === null) {
    return <p className="text-sm text-muted">{t('usageUnavailable')}</p>
  }
  const total = (stats ?? []).reduce((n, s) => n + s.count, 0)
  const empty = (stats === null || stats.length === 0) && (bw === null || bw.length === 0)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {empty ? t('usageEmpty', { range: safeRange }) : t('usageTotal', { total, range: safeRange })}
        </p>
        <label className="flex items-center gap-2 text-xs text-muted">
          {t('rangeLabel')}
          <RangeSelector current={safeRange} />
        </label>
      </div>

      {stats !== null && stats.length > 0 && <RequestTable stats={stats} t={t} />}
      {bw !== null && bw.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold">{t('bandwidthTitle', { range: safeRange })}</h3>
          <BandwidthTable bw={bw} t={t} />
        </>
      )}
    </div>
  )
}

type T = Awaited<ReturnType<typeof getTranslations>>

export function RequestTable({ stats, t }: { stats: { service: string; code: string; count: number }[]; t: T }) {
  const max = Math.max(...stats.map((s) => s.count))
  return (
    <table className="table-base">
      <thead>
        <tr><th>{t('kongService')}</th><th>{t('status')}</th><th className="w-1/2">{t('countCol')}</th></tr>
      </thead>
      <tbody>
        {stats.map((s) => {
          const tone = codeTone(s.code)
          return (
            <tr key={s.service + s.code}>
              <td className="font-mono text-xs whitespace-nowrap">{s.service}</td>
              <td><span className={`${tone.badge} font-mono`}>{s.code}</span></td>
              <td>
                <div className="flex items-center gap-3">
                  <Bar ratio={s.count / max} tone={tone.bar} />
                  <span className="font-mono text-xs tabular-nums whitespace-nowrap">{s.count.toLocaleString()}</span>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function BandwidthTable({ bw, t }: { bw: { service: string; type: string; bytes: number }[]; t: T }) {
  const max = Math.max(...bw.map((s) => s.bytes))
  return (
    <table className="table-base">
      <thead>
        <tr><th>{t('kongService')}</th><th>{t('typeCol')}</th><th className="w-1/2">Bandwidth</th></tr>
      </thead>
      <tbody>
        {bw.map((s) => (
          <tr key={s.service + s.type}>
            <td className="font-mono text-xs whitespace-nowrap">{s.service}</td>
            <td className="text-xs text-ink-soft whitespace-nowrap">{s.type === 'egress' ? '↓ egress' : '↑ ingress'}</td>
            <td>
              <div className="flex items-center gap-3">
                <Bar ratio={s.bytes / max} tone="bg-amber" />
                <span className="font-mono text-xs tabular-nums whitespace-nowrap">{fmtBytes(s.bytes)}</span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
