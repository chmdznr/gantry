import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonError, jsonOk } from '@/lib/admin-api-http'
import { KongError, listServices } from '@/lib/kong'

// Kong Admin API yang lambat/hang sudah dibatasi AbortSignal.timeout di
// src/lib/kong.ts; di sini cukup memetakan kegagalannya ke envelope aman.
export async function GET(req: Request) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  let services: { name: string; host: string }[]
  try {
    services = await listServices()
  } catch (err) {
    return jsonError(502, 'internal_error', 'Kong Admin API is unavailable.', {
      details: { upstream: 'kong', ...(err instanceof KongError ? { status: err.status } : {}) },
    })
  }

  const catalog = await db
    .select({ id: apiProducts.id, slug: apiProducts.slug, kongServiceNames: apiProducts.kongServiceNames })
    .from(apiProducts)
  const productsByService = new Map<string, { id: string; slug: string }[]>()
  for (const product of catalog) {
    for (const service of product.kongServiceNames) {
      const mapped = productsByService.get(service) ?? []
      mapped.push({ id: product.id, slug: product.slug })
      productsByService.set(service, mapped)
    }
  }

  return jsonOk({
    services: services
      .filter((service) => Boolean(service.name))
      .map((service) => {
        const mapped = productsByService.get(service.name) ?? []
        return { name: service.name, host: service.host, imported: mapped.length > 0, products: mapped }
      }),
  })
}
