'use client'

import { useActionState } from 'react'
import { adminSetPassword, type SetPasswordState } from '@/actions/admin-users'

function generatePassword(): string {
  // tanpa karakter ambigu (0/O, 1/l/I) — password ini dibacakan/disalin manual
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  const buf = new Uint32Array(14)
  crypto.getRandomValues(buf)
  return [...buf].map((n) => chars[n % chars.length]).join('')
}

export default function SetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<SetPasswordState, FormData>(adminSetPassword, {})
  return (
    <details className="inline-block align-middle">
      <summary className="btn-outline btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">Set password</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        {/* type=text disengaja: admin perlu melihat & menyalin password untuk dibagikan */}
        <input name="password" required minLength={8} className="input w-44 font-mono text-xs" placeholder="new password (min 8)" />
        <button
          type="button"
          className="btn-outline btn-sm"
          onClick={(e) => {
            const inp = e.currentTarget.form?.elements.namedItem('password') as HTMLInputElement
            inp.value = generatePassword()
          }}
        >Generate</button>
        <button disabled={pending} className="btn-primary btn-sm">{pending ? '…' : 'Save'}</button>
        {state.error && <span className="w-full text-xs text-stop">{state.error}</span>}
        {state.ok && <span className="w-full text-xs text-go">{state.ok}</span>}
      </form>
    </details>
  )
}
