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
      <h1 className="mb-1 text-xl font-bold">Import dari Kong</h1>
      <p className="mb-4 text-sm text-gray-500">
        Service Kong yang belum ada di katalog. Import membuat <b>draft</b> product — lengkapi deskripsi/spec lalu publish.
      </p>
      {kongDown ? (
        <p className="text-sm text-red-600">Kong Admin API tidak terjangkau. Cek <Link href="/admin/setup" className="underline">Setup</Link>.</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-gray-500">Semua service Kong sudah ada di katalog.</p>
      ) : (
        <form action={importProducts}>
          <table className="w-full max-w-3xl border-collapse text-sm">
            <thead><tr className="border-b text-left"><th className="w-8 py-2"></th><th>Service</th><th>Upstream</th><th>Routes</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name} className="border-b">
                  <td className="py-2"><input type="checkbox" name="services" value={s.name} defaultChecked /></td>
                  <td className="font-mono text-xs">{s.name}</td>
                  <td className="font-mono text-xs text-gray-500">{s.host}</td>
                  <td className="font-mono text-xs">{s.routes.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Import terpilih</button>
        </form>
      )}
    </main>
  )
}
