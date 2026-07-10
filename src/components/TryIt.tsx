'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type Endpoint = { method: string; path: string; summary?: string; routable?: boolean }
type TryResult = { status?: number; durationMs?: number; headers?: Record<string, string>; body?: string; error?: string }

const methodChip: Record<string, string> = {
  GET: 'bg-go-soft text-go',
  POST: 'bg-ink text-paper',
  PUT: 'bg-warn-soft text-warn',
  PATCH: 'bg-warn-soft text-warn',
  DELETE: 'bg-stop-soft text-stop',
}

// Dropdown custom — popup select native dirender OS (posisi/tema di luar kendali halaman).
function EndpointPicker({ endpoints, method, path, onPick }: {
  endpoints: Endpoint[]
  method: string
  path: string
  onPick: (method: string, path: string) => void
}) {
  const t = useTranslations('tryit')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const current = endpoints.find((x) => x.method.toUpperCase() === method && x.path === path)

  return (
    <div ref={ref} className="relative mb-3 max-w-xl">
      <span className="label">{t('pickEndpoint')}</span>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        className="input flex w-full items-center gap-2 text-left">
        <span className={`w-14 rounded py-0.5 text-center font-mono text-xs font-bold ${methodChip[method] ?? 'bg-line/60'}`}>{method}</span>
        <span className="truncate font-mono text-xs">{path}</span>
        {current?.summary && <span className="truncate text-xs text-muted">— {current.summary}</span>}
        <span className={`ml-auto text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-[0_8px_24px_-6px_rgb(16_49_43_/_0.25)]">
          {endpoints.map((x) => {
            const m = x.method.toUpperCase()
            const active = m === method && x.path === path
            return (
              <li key={m + x.path} role="option" aria-selected={active}>
                <button type="button" disabled={x.routable === false}
                  onClick={() => { onPick(m, x.path); setOpen(false) }}
                  title={x.routable === false ? t('notRoutable') : undefined}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${x.routable === false ? 'cursor-not-allowed opacity-50' : 'hover:bg-paper'} ${active ? 'bg-paper' : ''}`}>
                  <span className={`w-14 rounded py-0.5 text-center font-mono text-xs font-bold ${methodChip[m] ?? 'bg-line/60'}`}>{m}</span>
                  <span className="font-mono text-xs">{x.path}</span>
                  {x.summary && <span className="truncate text-xs text-muted">— {x.summary}</span>}
                  {x.routable === false && <span className="ml-auto shrink-0 badge-stop">{t('notRoutable')}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function TryIt({ productId, baseUrl, endpoints }: {
  productId: string
  baseUrl: string
  endpoints: Endpoint[]
}) {
  const t = useTranslations('tryit')
  const first = endpoints.find((e) => e.routable !== false) ?? endpoints[0]
  const [method, setMethod] = useState(first?.method?.toUpperCase() ?? 'GET')
  const [path, setPath] = useState(first?.path ?? '/')
  const [apiKey, setApiKey] = useState('')
  const [body, setBody] = useState('')
  const [result, setResult] = useState<TryResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function send() {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/try', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId, method, path, apiKey,
          ...(method !== 'GET' && body ? { body, contentType: 'application/json' } : {}),
        }),
      })
      setResult(await res.json())
    } catch {
      setResult({ error: t('requestFailed') })
    } finally {
      setBusy(false)
    }
  }

  const blocked = endpoints.some((e) => e.routable === false && e.method.toUpperCase() === method && e.path === path)

  const statusColor = (s?: number) =>
    !s ? '' : s < 300 ? 'text-go' : s < 500 ? 'text-warn' : 'text-stop'

  return (
    <div className="card">
      {endpoints.length > 0 && (
        <EndpointPicker endpoints={endpoints} method={method} path={path}
          onPick={(m, p) => { setMethod(m); setPath(p) }} />
      )}
      <div className="flex flex-wrap items-end gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="input w-auto">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="pb-2 font-mono text-xs text-muted">{baseUrl}</span>
        <input value={path} onChange={(e) => setPath(e.target.value)}
          className="input min-w-40 flex-1 font-mono" />
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t('apikeyPlaceholder')}
          type="password" className="input w-56 font-mono" />
        <button onClick={send} disabled={busy || blocked}
          className="btn-primary">
          {busy ? t('sending') : t('send')}
        </button>
      </div>
      {blocked && <p className="mt-2 text-sm text-warn">{t('notRoutableHint')}</p>}
      {method !== 'GET' && (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          placeholder={t('bodyPlaceholder')} className="input mt-2 font-mono" />
      )}
      {result && (
        <div className="mt-3 rounded bg-paper p-3 text-sm">
          {result.error ? (
            <p className="text-stop">{result.error}</p>
          ) : (
            <>
              <p>
                <b className={statusColor(result.status)}>HTTP {result.status}</b>
                <span className="ml-3 text-muted">{result.durationMs} ms</span>
                {result.headers?.['ratelimit-remaining'] !== undefined && (
                  <span className="ml-3 text-muted">
                    {t('rateRemaining', { left: result.headers['ratelimit-remaining'], limit: result.headers['ratelimit-limit'] })}
                  </span>
                )}
              </p>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-xs">{result.body}</pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}
