import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk, parseJsonBody } from '@/lib/admin-api-http'
import { importKongServices } from '@/lib/admin-operations/products'

const importSchema = z.object({
  services: z.array(z.string().min(1)).min(1),
})

export async function POST(req: Request) {
  const auth = await requireAdminApi(req, 'products:write')
  if (!auth.ok) return auth.response

  const body = await parseJsonBody(req, importSchema)
  if (!body.ok) return body.response

  const results = await importKongServices(auth.actor, body.data.services)
  return jsonOk(results)
}
