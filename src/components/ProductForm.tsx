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
          <span className="mb-1 block text-muted">Slug (catalog URL)</span>
          <input name="slug" required defaultValue={initial?.slug} pattern="[a-z0-9-]{2,64}" className="input" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input name="name" required minLength={3} defaultValue={initial?.name} className="input" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Description</span>
        <textarea name="description" rows={4} defaultValue={initial?.description} className="input" />
      </label>
      <div className="grid grid-cols-3 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Version</span>
          <input name="version" defaultValue={initial?.version ?? '1.0.0'} className="input" />
        </label>
        <label className="col-span-2 text-sm">
          <span className="mb-1 block text-muted">Proxy base URL (shown to developers)</span>
          <input name="proxyBaseUrl" required defaultValue={initial?.proxyBaseUrl} placeholder="https://gw.kai.id/nama-api" className="input" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Kong service names (comma-separated)</span>
          <input name="kongServiceNames" required defaultValue={initial?.kongServiceNames?.join(', ')} placeholder="user-api, order-api" className="input" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">ACL group (defaults to slug)</span>
          <input name="aclGroup" defaultValue={initial?.aclGroup} className="input" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Tags (comma-separated)</span>
          <input name="tags" defaultValue={initial?.tags?.join(', ')} className="input" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">
            Spec: OpenAPI / Postman Collection (JSON){initial?.hasSpec ? ' — already set; upload to replace' : ''}
          </span>
          <input name="spec" type="file" accept="application/json,.json" className="w-full text-sm" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Change note (optional, recorded when a new spec is uploaded)</span>
        <input name="changeNote" className="input" placeholder="e.g. Added /orders, removed /legacy" />
      </label>
      {state.error && <p className="text-sm text-stop">{state.error}</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create API Product'}
      </button>
    </form>
  )
}
