'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

export type ActionState = { error?: string }

function parseForm(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const version = String(formData.get('version') ?? '1.0.0').trim()
  const proxyBaseUrl = String(formData.get('proxyBaseUrl') ?? '').trim()
  const aclGroup = String(formData.get('aclGroup') ?? '').trim() || slug
  const kongServiceNames = String(formData.get('kongServiceNames') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const tags = String(formData.get('tags') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)

  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return { error: 'Slug wajib: huruf kecil/angka/strip, 2-64 karakter.' }
  if (name.length < 3) return { error: 'Nama minimal 3 karakter.' }
  if (kongServiceNames.length === 0) return { error: 'Minimal satu Kong service name.' }
  if (!proxyBaseUrl.startsWith('http')) return { error: 'Proxy base URL wajib diawali http(s).' }
  return { values: { slug, name, description, version, proxyBaseUrl, aclGroup, kongServiceNames, tags } }
}

async function parseSpec(formData: FormData): Promise<{ error?: string; spec?: unknown | null }> {
  const file = formData.get('spec') as File | null
  if (!file || file.size === 0) return { spec: null }
  if (file.size > 5 * 1024 * 1024) return { error: 'Spec terlalu besar (maks 5MB).' }
  try {
    return { spec: JSON.parse(await file.text()) }
  } catch {
    return { error: 'File spec bukan JSON valid. (Gunakan OpenAPI JSON.)' }
  }
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const parsed = parseForm(formData)
  if (parsed.error || !parsed.values) return { error: parsed.error }
  const { spec, error } = await parseSpec(formData)
  if (error) return { error }

  let id: string
  try {
    const [row] = await db.insert(apiProducts).values({
      ...parsed.values,
      ...(spec !== null ? { openapiSpec: spec } : {}),
    }).returning({ id: apiProducts.id })
    id = row.id
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Slug sudah dipakai.' }
    throw err
  }
  await audit(session.user.id, 'product.create', 'api_product', id, { slug: parsed.values.slug })
  revalidatePath('/admin/apis')
  redirect(`/admin/apis/${id}`)
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const parsed = parseForm(formData)
  if (parsed.error || !parsed.values) return { error: parsed.error }
  const { spec, error } = await parseSpec(formData)
  if (error) return { error }

  try {
    await db.update(apiProducts).set({
      ...parsed.values,
      ...(spec !== null ? { openapiSpec: spec } : {}),
      updatedAt: new Date(),
    }).where(eq(apiProducts.id, id))
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Slug sudah dipakai.' }
    throw err
  }
  await audit(session.user.id, 'product.update', 'api_product', id, { slug: parsed.values.slug })
  revalidatePath('/admin/apis')
  revalidatePath(`/admin/apis/${id}`)
  revalidatePath(`/apis/${parsed.values.slug}`)
  return {}
}

export async function setProductStatus(id: string, status: 'draft' | 'published' | 'deprecated' | 'retired'): Promise<void> {
  const session = await requireAdmin()
  await db.update(apiProducts).set({ status, updatedAt: new Date() }).where(eq(apiProducts.id, id))
  await audit(session.user.id, `product.${status}`, 'api_product', id)
  revalidatePath('/admin/apis')
  revalidatePath(`/admin/apis/${id}`)
  revalidatePath('/')
}

// Import service Kong yang belum ada di katalog menjadi draft product.
export async function importProducts(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const names = formData.getAll('services').map(String).filter(Boolean)
  const proxyBase = process.env.KONG_PROXY_URL ?? 'http://localhost:8104'
  for (const svc of names) {
    const slug = svc.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
    if (slug.length < 2) continue
    try {
      const [row] = await db.insert(apiProducts).values({
        slug,
        name: svc,
        description: `API ${svc} (diimpor dari Kong — lengkapi deskripsi).`,
        aclGroup: slug,
        kongServiceNames: [svc],
        proxyBaseUrl: proxyBase,
      }).returning({ id: apiProducts.id })
      await audit(session.user.id, 'product.import', 'api_product', row.id, { service: svc })
    } catch (err) {
      if (!isUniqueViolation(err)) throw err // slug bentrok -> lewati diam-diam
    }
  }
  revalidatePath('/admin/apis')
  redirect('/admin/apis')
}
