'use client'

import { useFormStatus } from 'react-dom'

// Tombol submit dengan pending state — dipakai di form server-action admin.
export default function PendingButton({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className={`${className ?? ''} disabled:opacity-50`}>
      {pending ? '…' : children}
    </button>
  )
}
