'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import { parseSpecText } from '@/lib/spec-edit'
import {
  MAX_SPEC_BYTES,
  createProductRecord,
  importKongServices,
  replaceProductSpec,
  setProductStatusRecord,
  updateProductRecord,
  validateProductFields,
  type ProductInput,
  type ProductStatus,
} from '@/lib/admin-operations/products'

export type ActionState = { error?: string; ok?: boolean }

// FormData -> nilai mentah; aturan validasi tetap di modul operasi bersama.
function parseForm(formData: FormData): ProductInput {
  return {
    slug: String(formData.get('slug') ?? '').trim().toLowerCase(),
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    version: String(formData.get('version') ?? '1.0.0').trim(),
    proxyBaseUrl: String(formData.get('proxyBaseUrl') ?? '').trim(),
    aclGroup: String(formData.get('aclGroup') ?? '').trim(),
    kongServiceNames: String(formData.get('kongServiceNames') ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean),
    tags: String(formData.get('tags') ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean),
  }
}

async function parseSpecFile(formData: FormData): Promise<{ error?: string; spec?: unknown | null }> {
  const file = formData.get('spec') as File | null
  if (!file || file.size === 0) return { spec: null }
  if (file.size > MAX_SPEC_BYTES) return { error: 'Spec terlalu besar (maks 5MB).' }
  try {
    return { spec: JSON.parse(await file.text()) }
  } catch {
    return { error: 'File bukan JSON valid. (Terima: OpenAPI JSON atau Postman Collection v2.)' }
  }
}

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const values = parseForm(formData)
  const validation = validateProductFields(values)
  if (!validation.ok) return { error: validation.message }
  const { spec, error } = await parseSpecFile(formData)
  if (error) return { error }

  const result = await createProductRecord(
    { userId: session.user.id },
    { ...values, spec, changeNote: String(formData.get('changeNote') ?? '') },
  )
  if (!result.ok) return { error: result.message }
  redirect(`/admin/apis/${result.data.id}`)
}

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const values = parseForm(formData)
  const validation = validateProductFields(values)
  if (!validation.ok) return { error: validation.message }
  const { spec, error } = await parseSpecFile(formData)
  if (error) return { error }

  const result = await updateProductRecord({ userId: session.user.id }, id, values, {
    spec,
    changeNote: String(formData.get('changeNote') ?? ''),
  })
  return result.ok ? {} : { error: result.message }
}

// Edit spec langsung dari editor web. Selalu snapshot bila konten berubah
// (termasuk perubahan doc-only) — beda dengan upload yang hanya snapshot
// saat endpoint berubah, karena edit manual adalah tindakan sengaja.
export async function updateProductSpec(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const text = String(formData.get('specText') ?? '')
  if (text.length > MAX_SPEC_BYTES) return { error: 'Spec terlalu besar (maks 5MB).' }

  const { error, spec } = parseSpecText(text)
  if (error || spec === undefined) return { error }

  const result = await replaceProductSpec(
    { userId: session.user.id },
    id,
    spec,
    String(formData.get('changeNote') ?? ''),
  )
  return result.ok ? { ok: true } : { error: result.message }
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<void> {
  const session = await requireAdmin()
  // UI lama mengabaikan id yang tidak ada; pertahankan perilaku itu.
  await setProductStatusRecord({ userId: session.user.id }, id, status)
}

// Import service Kong yang belum ada di katalog menjadi draft product.
export async function importProducts(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const names = formData.getAll('services').map(String).filter(Boolean)
  await importKongServices({ userId: session.user.id }, names)
  redirect('/admin/apis')
}
