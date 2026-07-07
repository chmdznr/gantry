'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { setLocale } from '@/actions/locale'

const LABELS: Record<string, string> = { en: 'EN', id: 'ID' }

export default function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex overflow-hidden rounded-lg border border-paper/25 text-xs font-semibold" role="group" aria-label="Language">
      {Object.entries(LABELS).map(([code, label]) => (
        <button key={code} type="button" disabled={pending}
          onClick={() => startTransition(async () => { await setLocale(code); router.refresh() })}
          className={`px-2 py-1 transition-colors ${locale === code ? 'bg-amber text-ink' : 'text-paper/70 hover:text-paper'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
