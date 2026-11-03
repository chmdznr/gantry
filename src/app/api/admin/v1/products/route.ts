import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { ADMIN_API_MAX_JSON_BYTES, jsonOk, parseJsonBody } from '@/lib/admin-api-http'
import { createProductRecord } from '@/lib/admin-operations/products'
import { productFailureResponse } from './_lib'

const createProductSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  proxyBaseUrl: z.string(),
  aclGroup: z.string().optional(),
  kongServiceNames: z.array(z.string()),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'published']).optional(),
  spec: z.unknown().optional(),
  changeNote: z.string().optional(),
})

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

export async function POST(req: Request) {
  const auth = await requireAdminApi(req, 'products:write')
  if (!auth.ok) return auth.response

  // Spec awal boleh sebesar batas upload form (5 MiB).
  const body = await parseJsonBody(req, createProductSchema, { maxBytes: ADMIN_API_MAX_JSON_BYTES })
  if (!body.ok) return body.response

  const result = await createProductRecord(auth.actor, body.data)
  if (!result.ok) return productFailureResponse(result)
  return jsonOk(result.data, { status: 201 })
}
