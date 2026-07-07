import Link from 'next/link'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { listServiceRoutes, listServices } from '@/lib/kong'
import { importProducts } from '@/actions/admin-products'

export default async function ImportApisPage() {
  let services: { name: string; host: string; routes: string[] }[] = []
  let kongDown = false
  try {
    const [all, products] = await Promise.all([
      listServices(),
      db.select({ names: apiProducts.kongServiceNames }).from(apiProducts),
    ])
    const used = new Set(products.flatMap((p) => p.names))
    const fresh = all.filter((s) => s.name && !used.has(s.name))
    services = await Promise.all(fresh.map(async (s) => ({
      ...s,
      routes: (await listServiceRoutes(s.name).catch(() => [])).flatMap((r) => r.paths),
    })))
  } catch {
    kongDown = true
  }

  return (
    <main>
      <h1 className="mb-1 text-xl font-bold">Import from Kong</h1>
      <p className="mb-4 text-sm text-muted">
        Kong services not yet in the catalog. Importing creates a <b>draft</b> product — fill in the description/spec, then publish.
      </p>
      {kongDown ? (
        <p className="text-sm text-stop">Kong Admin API is unreachable. Cek <Link href="/admin/setup" className="underline">Setup</Link>.</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted">All Kong services are already in the catalog.</p>
      ) : (
        <form action={importProducts}>
          <table className="table-base max-w-3xl">
            <thead><tr><th className="w-8"></th><th>Service</th><th>Upstream</th><th>Routes</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name}>
                  <td><input type="checkbox" name="services" value={s.name} defaultChecked /></td>
                  <td className="font-mono text-xs">{s.name}</td>
                  <td className="font-mono text-xs text-muted">{s.host}</td>
                  <td className="font-mono text-xs">{s.routes.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Import selected</button>
        </form>
      )}
    </main>
  )
}
