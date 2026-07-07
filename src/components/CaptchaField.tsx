'use client'

import { useState } from 'react'

export default function CaptchaField() {
  const [nonce, setNonce] = useState(0)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/captcha?n=${nonce}`} alt="captcha" className="h-12 rounded border bg-surface" />
        <button type="button" onClick={() => setNonce(nonce + 1)} className="text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">
          ganti gambar
        </button>
      </div>
      <input name="captcha" required placeholder="Ketik teks pada gambar"
        className="input" />
    </div>
  )
}
