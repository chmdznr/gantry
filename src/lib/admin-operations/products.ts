import { desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { apiProducts, apiProductSpecVersions } from '@/db/schema'
import { audit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'
import { diffEndpoints, isEmptyDiff } from '@/lib/openapi-diff'
import { isPostmanCollection, postmanToOpenApi } from '@/lib/postman'
import { specsEqual } from '@/lib/spec-edit'

// Aturan bisnis produk dipakai bersama oleh Server Action (UI) dan Admin API.
// Modul ini tidak boleh tahu soal FormData/Response; pemanggil yang memetakan
// hasil { ok:false } ke error UI atau status HTTP.

export const PRODUCT_STATUSES = ['draft', 'published', 'deprecated', 'retired'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export type CreateProductStatus = Extract<ProductStatus, 'draft' | 'published'>

export type ProductFields = {
  slug: string
  name: string
  description: string
  version: string
  proxyBaseUrl: string
  aclGroup: string
  kongServiceNames: string[]
  tags: string[]
}

export type ProductInput = {
  slug: string
  name: string
  description?: string
  version?: string
  proxyBaseUrl: string
  aclGroup?: string
  kongServiceNames: string[]
  tags?: string[]
}

export type CreateProductInput = ProductInput & {
  status?: CreateProductStatus
  spec?: unknown
  changeNote?: string
}

export type ProductActor = {
  userId: string
  tokenId?: string
  tokenPrefix?: string
}

export type ProductFailure = {
  ok: false
  kind: 'validation' | 'not_found' | 'conflict'
  message: string
}

export type ProductResult<T> = { ok: true; data: T } | ProductFailure

export type ProductRow = typeof apiProducts.$inferSelect
export type SpecVersionRow = typeof apiProductSpecVersions.$inferSelect

export const MAX_SPEC_BYTES = 5 * 1024 * 1024

// Pesan sama dengan validasi form UI supaya perilaku kedua jalur identik.
export function validateProductFields(
  input: ProductInput,
): { ok: true; values: ProductFields } | { ok: false; message: string } {
  const slug = input.slug.trim().toLowerCase()
  const name = input.name.trim()
  const kongServiceNames = input.kongServiceNames.map((s) => s.trim()).filter(Boolean)
  const tags = (input.tags ?? []).map((s) => s.trim()).filter(Boolean)
  const proxyBaseUrl = input.proxyBaseUrl.trim()

  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return { ok: false, message: 'Slug wajib: huruf kecil/angka/strip, 2-64 karakter.' }
  if (name.length < 3) return { ok: false, message: 'Nama minimal 3 karakter.' }
  if (kongServiceNames.length === 0) return { ok: false, message: 'Minimal satu Kong service name.' }
  if (!proxyBaseUrl.startsWith('http')) return { ok: false, message: 'Proxy base URL wajib diawali http(s).' }

  return {
    ok: true,
    values: {
      slug,
      name,
      description: (input.description ?? '').trim(),
      version: (input.version ?? '1.0.0').trim(),
      proxyBaseUrl,
      aclGroup: (input.aclGroup ?? '').trim() || slug,
      kongServiceNames,
      tags,
    },
  }
}

// Postman Collection v2.x dikonversi otomatis ke OpenAPI. `requirePaths`
// mencerminkan jalur editor spec (wajib punya `paths`), sedangkan upload
// produk menerima JSON apa pun seperti form UI.
export function normalizeProductSpec(
  raw: unknown,
  options: { requirePaths?: boolean } = {},
): { ok: true; spec: unknown } | { ok: false; message: string } {
  let spec = raw
  if (isPostmanCollection(spec)) spec = postmanToOpenApi(spec)
  if (options.requirePaths) {
    const paths = (spec as { paths?: unknown } | null)?.paths
    if (typeof spec !== 'object' || spec === null || typeof paths !== 'object' || paths === null) {
      return { ok: false, message: 'Spec harus object OpenAPI dengan properti "paths".' }
    }
  }
  return { ok: true, spec }
}

function auditPayload(actor: ProductActor, extra?: Record<string, unknown>) {
  const payload: Record<string, unknown> = { ...extra }
  if (actor.tokenId) payload.tokenId = actor.tokenId
  if (actor.tokenPrefix) payload.tokenPrefix = actor.tokenPrefix
  return payload
}

async function recordAudit(
  actor: ProductActor,
  action: string,
  productId: string,
  extra?: Record<string, unknown>,
) {
  const payload = auditPayload(actor, extra)
  await audit(actor.userId, action, 'api_product', productId, Object.keys(payload).length ? payload : undefined)
}

async function snapshotSpec(
  productId: string,
  version: string,
  oldSpec: unknown,
  newSpec: unknown,
  note: string | undefined,
  actorId: string,
) {
  const changelog = diffEndpoints(oldSpec, newSpec)
  const [row] = await db.insert(apiProductSpecVersions).values({
    apiProductId: productId,
    version,
    spec: newSpec,
    changelog,
    note: note || null,
    createdBy: actorId,
  }).returning()
  return row
}

export async function getProductRecord(id: string): Promise<ProductRow | null> {
  return (await db.query.apiProducts.findFirst({ where: eq(apiProducts.id, id) })) ?? null
}

export async function createProductRecord(
  actor: ProductActor,
  input: CreateProductInput,
): Promise<ProductResult<ProductRow>> {
  const parsed = validateProductFields(input)
  if (!parsed.ok) return { ok: false, kind: 'validation', message: parsed.message }

  let spec: unknown = null
  if (input.spec !== undefined && input.spec !== null) {
    const normalized = normalizeProductSpec(input.spec)
    if (!normalized.ok) return { ok: false, kind: 'validation', message: normalized.message }
    spec = normalized.spec
  }

  let product: ProductRow
  try {
    const [row] = await db.insert(apiProducts).values({
      ...parsed.values,
      ...(input.status ? { status: input.status } : {}),
      ...(spec !== null ? { openapiSpec: spec } : {}),
    }).returning()
    product = row
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, kind: 'conflict', message: 'Slug sudah dipakai.' }
    throw err
  }

  if (spec !== null) {
    await snapshotSpec(product.id, parsed.values.version, null, spec, input.changeNote, actor.userId)
  }
  await recordAudit(actor, 'product.create', product.id, { slug: parsed.values.slug })
  revalidatePath('/admin/apis')
  return { ok: true, data: product }
}

// `options.spec` mengikuti perilaku upload form: snapshot hanya jika endpoint
// berubah. PATCH API tidak mengirim opsi ini (spec punya endpoint sendiri).
export async function updateProductRecord(
  actor: ProductActor,
  id: string,
  input: Partial<ProductInput>,
  options: { spec?: unknown | null; changeNote?: string } = {},
): Promise<ProductResult<ProductRow>> {
  const current = await getProductRecord(id)
  if (!current) return { ok: false, kind: 'not_found', message: 'Product tidak ditemukan.' }

  const parsed = validateProductFields({
    slug: input.slug ?? current.slug,
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    version: input.version ?? current.version,
    proxyBaseUrl: input.proxyBaseUrl ?? current.proxyBaseUrl,
    aclGroup: input.aclGroup ?? current.aclGroup,
    kongServiceNames: input.kongServiceNames ?? current.kongServiceNames,
    tags: input.tags ?? current.tags,
  })
  if (!parsed.ok) return { ok: false, kind: 'validation', message: parsed.message }

  let spec: unknown = null
  if (options.spec !== undefined && options.spec !== null) {
    const normalized = normalizeProductSpec(options.spec)
    if (!normalized.ok) return { ok: false, kind: 'validation', message: normalized.message }
    spec = normalized.spec
  }

  let product: ProductRow
  try {
    const [row] = await db.update(apiProducts).set({
      ...parsed.values,
      ...(spec !== null ? { openapiSpec: spec } : {}),
      updatedAt: new Date(),
    }).where(eq(apiProducts.id, id)).returning()
    if (!row) return { ok: false, kind: 'not_found', message: 'Product tidak ditemukan.' }
    product = row
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, kind: 'conflict', message: 'Slug sudah dipakai.' }
    throw err
  }

  if (spec !== null && !isEmptyDiff(diffEndpoints(current.openapiSpec, spec))) {
    await snapshotSpec(id, parsed.values.version, current.openapiSpec, spec, options.changeNote, actor.userId)
  }
  await recordAudit(actor, 'product.update', id, { slug: parsed.values.slug })
  revalidatePath('/admin/apis')
  revalidatePath(`/admin/apis/${id}`)
  revalidatePath(`/apis/${parsed.values.slug}`)
  return { ok: true, data: product }
}

// Edit spec dari editor/API: selalu snapshot bila konten berubah (termasuk
// perubahan doc-only), karena tindakan ini sengaja menulis spec.
export async function replaceProductSpec(
  actor: ProductActor,
  id: string,
  rawSpec: unknown,
  changeNote?: string,
): Promise<ProductResult<{ product: ProductRow; specVersion: SpecVersionRow | null }>> {
  const current = await getProductRecord(id)
  if (!current) return { ok: false, kind: 'not_found', message: 'Product tidak ditemukan.' }

  const normalized = normalizeProductSpec(rawSpec, { requirePaths: true })
  if (!normalized.ok) return { ok: false, kind: 'validation', message: normalized.message }
  const spec = normalized.spec

  if (specsEqual(current.openapiSpec, spec)) {
    return { ok: true, data: { product: current, specVersion: null } }
  }

  const [product] = await db.update(apiProducts).set({
    openapiSpec: spec,
    updatedAt: new Date(),
  }).where(eq(apiProducts.id, id)).returning()
  if (!product) return { ok: false, kind: 'not_found', message: 'Product tidak ditemukan.' }

  const specVersion = await snapshotSpec(id, current.version, current.openapiSpec, spec, changeNote, actor.userId)
  await recordAudit(actor, 'product.spec-edit', id, { slug: current.slug })
  revalidatePath(`/admin/apis/${id}`)
  revalidatePath(`/admin/apis/${id}/spec`)
  revalidatePath(`/apis/${current.slug}`)
  return { ok: true, data: { product, specVersion } }
}

export async function setProductStatusRecord(
  actor: ProductActor,
  id: string,
  status: ProductStatus,
): Promise<ProductResult<ProductRow>> {
  const [product] = await db.update(apiProducts).set({ status, updatedAt: new Date() })
    .where(eq(apiProducts.id, id)).returning()
  if (!product) return { ok: false, kind: 'not_found', message: 'Product tidak ditemukan.' }

  await recordAudit(actor, `product.${status}`, id)
  revalidatePath('/admin/apis')
  revalidatePath(`/admin/apis/${id}`)
  revalidatePath('/')
  return { ok: true, data: product }
}

export type SpecVersionSummary = Pick<
  SpecVersionRow,
  'id' | 'version' | 'changelog' | 'note' | 'createdBy' | 'createdAt'
>

// Sengaja tanpa kolom `spec`: daftar versi tidak boleh mengirim puluhan MB.
export async function listProductSpecVersions(id: string): Promise<ProductResult<SpecVersionSummary[]>> {
  const product = await db.query.apiProducts.findFirst({
    where: eq(apiProducts.id, id),
    columns: { id: true },
  })
  if (!product) return { ok: false, kind: 'not_found', message: 'Product tidak ditemukan.' }

  const versions = await db
    .select({
      id: apiProductSpecVersions.id,
      version: apiProductSpecVersions.version,
      changelog: apiProductSpecVersions.changelog,
      note: apiProductSpecVersions.note,
      createdBy: apiProductSpecVersions.createdBy,
      createdAt: apiProductSpecVersions.createdAt,
    })
    .from(apiProductSpecVersions)
    .where(eq(apiProductSpecVersions.apiProductId, id))
    .orderBy(desc(apiProductSpecVersions.createdAt))
  return { ok: true, data: versions }
}

export function kongServiceSlug(service: string): string {
  return service.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

export type ImportServiceResult = {
  service: string
  status: 'imported' | 'skippedExisting' | 'error'
  slug?: string
  productId?: string
  error?: string
}

// Import service Kong yang belum ada di katalog menjadi draft product.
// Per-service: service yang sudah dipakai atau slug-nya bentrok dilewati,
// kegagalan lain dilaporkan tanpa membatalkan service lain.
export async function importKongServices(
  actor: ProductActor,
  services: string[],
): Promise<{ results: ImportServiceResult[] }> {
  const proxyBase = process.env.KONG_PROXY_URL ?? 'http://localhost:8104'
  const existingRows = await db
    .select({ kongServiceNames: apiProducts.kongServiceNames })
    .from(apiProducts)
  const existing = new Set(existingRows.flatMap((row) => row.kongServiceNames))
  const results: ImportServiceResult[] = []

  for (const service of services) {
    const slug = kongServiceSlug(service)
    if (slug.length < 2) {
      results.push({ service, status: 'error', error: 'Service name cannot be converted to a valid slug.' })
      continue
    }
    if (existing.has(service)) {
      results.push({ service, status: 'skippedExisting', slug })
      continue
    }
    let productId: string
    try {
      const [row] = await db.insert(apiProducts).values({
        slug,
        name: service,
        description: `API ${service} (diimpor dari Kong — lengkapi deskripsi).`,
        aclGroup: slug,
        kongServiceNames: [service],
        proxyBaseUrl: proxyBase,
      }).returning({ id: apiProducts.id })
      productId = row.id
    } catch (err) {
      if (isUniqueViolation(err)) results.push({ service, status: 'skippedExisting', slug })
      else results.push({ service, status: 'error', error: 'Import failed.' })
      continue
    }

    existing.add(service)
    results.push({ service, status: 'imported', slug, productId })
    await recordAudit(actor, 'product.import', productId, { service })
  }

  revalidatePath('/admin/apis')
  return { results }
}
