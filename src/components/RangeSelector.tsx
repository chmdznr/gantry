'use client'

import { useRouter } from 'next/navigation'
import { RANGES } from '@/lib/ranges'

export function RangeSelector({ current }: { current: string }) {
  const router = useRouter()
  return (
    <select
      defaultValue={current}
      onChange={(e) => {
        const url = new URL(window.location.href)
        url.searchParams.set('range', e.target.value)
        router.replace(url.pathname + url.search)
      }}
      className="input text-xs w-auto"
    >
      {RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  )
}
