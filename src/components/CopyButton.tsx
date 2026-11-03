'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { copyText } from '@/lib/clipboard'

export default function CopyButton({ value, className = 'btn-outline btn-sm' }: {
  value: string
  className?: string
}) {
  const t = useTranslations('apps')
  const [status, setStatus] = useState<'copied' | 'failed' | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    const ok = await copyText(value)
    window.clearTimeout(timer.current)
    setStatus(ok ? 'copied' : 'failed')
    timer.current = window.setTimeout(() => setStatus(null), 2500)
  }

  return (
    <span className="inline-flex shrink-0 items-center">
      <button type="button" onClick={copy} className={className}>
        {status === 'copied' ? t('copied') : status === 'failed' ? t('copyFailed') : t('copy')}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === 'copied' ? t('copied') : status === 'failed' ? t('copyFailed') : ''}
      </span>
    </span>
  )
}
