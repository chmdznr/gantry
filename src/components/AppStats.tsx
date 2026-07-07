import { getTranslations } from 'next-intl/server'
import { consumerRequestStats } from '@/lib/metrics'

const codeColor = (code: string) =>
  code.startsWith('2') ? 'bg-green-500' : code.startsWith('4') ? 'bg-yellow-500' : 'bg-red-500'

export default async function AppStats({ consumerUsername }: { consumerUsername: string }) {
  const t = await getTranslations('apps')
  const stats = await consumerRequestStats(consumerUsername)
  if (stats === null) {
    return <p className="text-sm text-muted">{t('usageUnavailable')}</p>
  }
  if (stats.length === 0) {
    return <p className="text-sm text-muted">{t('usageEmpty')}</p>
  }
  const total = stats.reduce((n, s) => n + s.count, 0)
  const max = Math.max(...stats.map((s) => s.count))
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{t('usageTotal', { total })}</p>
      <table className="w-full max-w-xl border-collapse text-sm">
        <thead><tr><th>{t('kongService')}</th><th>{t('status')}</th><th className="w-1/2">{t('countCol')}</th></tr></thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.service + s.code}>
              <td className="py-1 font-mono text-xs">{s.service}</td>
              <td className="font-mono text-xs">{s.code}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className={`h-3 rounded ${codeColor(s.code)}`} style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} />
                  <span className="text-xs">{s.count}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
