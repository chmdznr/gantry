import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { checkServiceSetup, listServiceRoutes, type ServiceCheck } from '@/lib/kong'
import ProductForm from '@/components/ProductForm'

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? 'text-green-700' : 'text-red-600'}>{ok ? '✓' : '✗'} {label}</span>
}

export default async function EditApiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await db.query.apiProducts.findFirst({ where: eq(apiProducts.id, id) })
  if (!product) notFound()

  let checks: (ServiceCheck & { routes: string[] })[] = []
  let kongDown = false
  try {
    checks = await Promise.all(product.kongServiceNames.map(async (s) => ({
      ...(await checkServiceSetup(s, product.aclGroup)),
      routes: (await listServiceRoutes(s).catch(() => [])).flatMap((r) => r.paths),
    })))
  } catch {
    kongDown = true
  }

  return (
    <main>
      <h1 className="mb-1 text-xl font-bold">{product.name}</h1>
      <p className="mb-4 text-sm text-gray-500">status: {product.status}</p>

      <div className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Setup checklist (read-only dari Kong)</h2>
        <p className="mb-2 text-xs text-gray-500">
          Proteksi route/service (plugin key-auth/jwt + acl allow <code>{product.aclGroup}</code>) adalah tanggung jawab sisi publisher — portal hanya memverifikasi.
        </p>
        {kongDown ? (
          <p className="text-sm text-red-600">Kong Admin API tidak terjangkau.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {checks.map((c) => (
              <li key={c.service} className="flex flex-wrap gap-4">
                <code className="rounded bg-gray-100 px-1">{c.service}</code>
                <Check ok={c.exists} label="service ada" />
                <Check ok={c.hasAuth} label="key-auth/jwt" />
                <Check ok={c.hasAcl} label="plugin acl" />
                <Check ok={c.aclAllowsGroup} label={`allow ${product.aclGroup}`} />
                <span className="font-mono text-xs text-gray-500">routes: {c.routes.join(', ') || '(tidak ada)'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProductForm initial={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        version: product.version,
        proxyBaseUrl: product.proxyBaseUrl,
        aclGroup: product.aclGroup,
        kongServiceNames: product.kongServiceNames,
        tags: product.tags,
        hasSpec: !!product.openapiSpec,
      }} />
    </main>
  )
}
