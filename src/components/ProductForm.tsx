'use client'

import { useActionState } from 'react'
import { createProduct, updateProduct, type ActionState } from '@/actions/admin-products'

export type ProductFormValues = {
  id?: string
  slug?: string
  name?: string
  description?: string
  version?: string
  proxyBaseUrl?: string
  aclGroup?: string
  kongServiceNames?: string[]
  tags?: string[]
  hasSpec?: boolean
}

export default function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const isEdit = !!initial?.id
  const [state, action, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateProduct : createProduct, {},
  )
  return (
    <form action={action} className="max-w-2xl space-y-4">
      {isEdit && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Slug (URL katalog)</span>
          <input name="slug" required defaultValue={initial?.slug} pattern="[a-z0-9-]{2,64}" className="w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Nama</span>
          <input name="name" required minLength={3} defaultValue={initial?.name} className="w-full rounded border px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Deskripsi</span>
        <textarea name="description" rows={4} defaultValue={initial?.description} className="w-full rounded border px-3 py-2" />
      </label>
      <div className="grid grid-cols-3 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Versi</span>
          <input name="version" defaultValue={initial?.version ?? '1.0.0'} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="col-span-2 text-sm">
          <span className="mb-1 block text-gray-600">Proxy base URL (dilihat developer)</span>
          <input name="proxyBaseUrl" required defaultValue={initial?.proxyBaseUrl} placeholder="https://gw.kai.id/nama-api" className="w-full rounded border px-3 py-2" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Kong service names (pisah koma)</span>
          <input name="kongServiceNames" required defaultValue={initial?.kongServiceNames?.join(', ')} placeholder="user-api, order-api" className="w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">ACL group (default = slug)</span>
          <input name="aclGroup" defaultValue={initial?.aclGroup} className="w-full rounded border px-3 py-2" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">Tags (pisah koma)</span>
          <input name="tags" defaultValue={initial?.tags?.join(', ')} className="w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600">
            OpenAPI spec (JSON){initial?.hasSpec ? ' — sudah ada; upload untuk mengganti' : ''}
          </span>
          <input name="spec" type="file" accept="application/json,.json" className="w-full text-sm" />
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat API Product'}
      </button>
    </form>
  )
}
