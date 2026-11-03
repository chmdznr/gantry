import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'

export async function GET(req: Request) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const rows = await db
    .select({
      id: apiProducts.id,
      slug: apiProducts.slug,
      name: apiProducts.name,
      description: apiProducts.description,
      version: apiProducts.version,
      status: apiProducts.status,
      tags: apiProducts.tags,
      aclGroup: apiProducts.aclGroup,
      proxyBaseUrl: apiProducts.proxyBaseUrl,
      kongServiceNames: apiProducts.kongServiceNames,
      createdAt: apiProducts.createdAt,
      updatedAt: apiProducts.updatedAt,
    })
    .from(apiProducts)
    .orderBy(desc(apiProducts.updatedAt))

  return jsonOk(rows)
}
