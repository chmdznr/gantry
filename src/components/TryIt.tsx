'use client'

import { useState } from 'react'

type Endpoint = { method: string; path: string; summary?: string }
type TryResult = { status?: number; durationMs?: number; headers?: Record<string, string>; body?: string; error?: string }

export default function TryIt({ productId, baseUrl, endpoints }: {
  productId: string
  baseUrl: string
  endpoints: Endpoint[]
}) {
  const [method, setMethod] = useState(endpoints[0]?.method?.toUpperCase() ?? 'GET')
  const [path, setPath] = useState(endpoints[0]?.path ?? '/')
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
      setResult({ error: 'Request gagal.' })
    } finally {
      setBusy(false)
    }
  }

  const statusColor = (s?: number) =>
    !s ? '' : s < 300 ? 'text-go' : s < 500 ? 'text-warn' : 'text-stop'

  return (
    <div className="card">
      {endpoints.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {endpoints.map((e) => (
            <button key={e.method + e.path} type="button"
              onClick={() => { setMethod(e.method.toUpperCase()); setPath(e.path) }}
              className="rounded border px-2 py-1 font-mono text-xs hover:border-amber">
              <b className="uppercase">{e.method}</b> {e.path}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="input w-auto">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="pb-2 font-mono text-xs text-muted">{baseUrl}</span>
        <input value={path} onChange={(e) => setPath(e.target.value)}
          className="input min-w-40 flex-1 font-mono" />
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="apikey (dari app kamu)"
          type="password" className="input w-56 font-mono" />
        <button onClick={send} disabled={busy}
          className="btn-primary">
          {busy ? 'Mengirim…' : 'Kirim'}
        </button>
      </div>
      {method !== 'GET' && (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          placeholder='Request body (JSON)' className="input mt-2 font-mono" />
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
                    rate limit sisa: {result.headers['ratelimit-remaining']}/{result.headers['ratelimit-limit']}
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
