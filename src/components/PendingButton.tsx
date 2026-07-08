'use client'

import { useFormStatus } from 'react-dom'

// Tombol submit dengan pending state — dipakai di form server-action admin.
// `confirm` opsional: dialog konfirmasi native sebelum submit (aksi destruktif).
export default function PendingButton({ children, className, confirm }: {
  children: React.ReactNode
  className?: string
  confirm?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      disabled={pending}
      className={`${className ?? ''} disabled:opacity-50`}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault() }}
    >
      {pending ? '…' : children}
    </button>
  )
}
