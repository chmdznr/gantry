'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MAX_MULTIPART_BYTES, type FormField, type TryEndpoint } from '@/lib/tryit'

type TryResult = { status?: number; durationMs?: number; headers?: Record<string, string>; body?: string; error?: string; code?: string }

// Baris header: `spec` = dideklarasikan spec (nama read-only, wajib diisi jika required),
// sisanya baris bebas user.
type HeaderRow = { name: string; value: string; spec: boolean; required: boolean }

const MB = MAX_MULTIPART_BYTES / (1024 * 1024)

const methodChip: Record<string, string> = {
  GET: 'bg-go-soft text-go',
  POST: 'bg-ink text-paper',
  PUT: 'bg-warn-soft text-warn',
  PATCH: 'bg-warn-soft text-warn',
  DELETE: 'bg-stop-soft text-stop',
}

function fmtBytes(n: number) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`
}

function specRows(endpoint?: TryEndpoint): HeaderRow[] {
  return (endpoint?.headerParams ?? []).map((h) => ({ name: h.name, value: '', spec: true, required: h.required }))
}

// Dropdown custom — popup select native dirender OS (posisi/tema di luar kendali halaman).
function EndpointPicker({ endpoints, method, path, onPick }: {
  endpoints: TryEndpoint[]
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
  endpoints: TryEndpoint[]
}) {
  const t = useTranslations('tryit')
  const first = endpoints.find((e) => e.routable !== false) ?? endpoints[0]
  const [method, setMethod] = useState(first?.method?.toUpperCase() ?? 'GET')
  const [path, setPath] = useState(first?.path ?? '/')
  const [apiKey, setApiKey] = useState('')
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() => specRows(first))
  const [body, setBody] = useState('')
  const [text, setText] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<TryResult | null>(null)
  const [busy, setBusy] = useState(false)

  const current = endpoints.find((e) => e.method.toUpperCase() === method && e.path === path)
  // GET tidak punya body; endpoint dengan schema yang tidak bisa dibaca dimatikan.
  const multipart = method !== 'GET' && current?.bodyContentType === 'multipart/form-data'
  const unsupported = method !== 'GET' && current?.bodyContentType === 'unsupported'

  function pick(m: string, p: string) {
    setMethod(m)
    setPath(p)
    setText({})
    setFiles({})
    setHeaderRows(specRows(endpoints.find((e) => e.method.toUpperCase() === m && e.path === p)))
    setFormError(null)
    setResult(null)
  }

  // Hanya baris terisi yang dikirim; validasi nama/izin tetap di server.
  function headerValues(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const row of headerRows) {
      const name = row.name.trim()
      if (name && row.value !== '') out[name] = row.value
    }
    return out
  }

  // Bangun FormData upstream: kontrol berprefiks @ (F5), field mengikuti schema.
  // Nama field/file berprefiks @ dari spec dilewati supaya tidak menabrak kontrol.
  function buildMultipart(headers: Record<string, string>): FormData | null {
    const fields: FormField[] = (current?.formFields ?? []).filter((f) => !f.unsupported && !f.name.startsWith('@'))
    const filled = fields.some((f) =>
      f.type === 'binary' ? (files[f.name]?.length ?? 0) > 0 : (text[f.name] ?? '') !== '')
    if (!filled) {
      setFormError(t('multipartBodyEmpty'))
      return null
    }

    const fd = new FormData()
    fd.set('@productId', productId)
    fd.set('@method', method)
    fd.set('@path', path)
    if (apiKey) fd.set('@apiKey', apiKey)
    if (Object.keys(headers).length > 0) fd.set('@headers', JSON.stringify(headers))

    let total = 0
    for (const f of fields) {
      if (f.type === 'binary') {
        const picked = files[f.name] ?? []
        if (picked.length === 0) {
          if (f.required) {
            setFormError(t('fileRequired', { field: f.name }))
            return null
          }
          continue
        }
        for (const file of picked) {
          if (file.size > MAX_MULTIPART_BYTES) {
            setFormError(t('fileSizeLimit', { size: MB }))
            return null
          }
          total += file.size
          fd.append(f.name, file)
        }
      } else {
        const value = text[f.name] ?? ''
        if (!value) {
          if (f.required) {
            setFormError(t('fieldRequired', { field: f.name }))
            return null
          }
          continue
        }
        fd.append(f.name, value)
      }
    }
    if (total > MAX_MULTIPART_BYTES) {
      setFormError(t('uploadTooLarge', { size: MB }))
      return null
    }
    return fd
  }

  async function send() {
    setFormError(null)
    const missing = headerRows.find((row) => row.spec && row.required && row.value === '')
    if (missing) {
      setFormError(t('headerRequired', { name: missing.name }))
      return
    }
    const headers = headerValues()
    const fd = multipart ? buildMultipart(headers) : null
    if (multipart && !fd) return

    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/try', fd
        ? { method: 'POST', body: fd }
        : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId, method, path, apiKey,
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
            ...(method !== 'GET' && body ? { body, contentType: 'application/json' } : {}),
          }),
        })
      const data = (await res.json()) as TryResult
      // Kode error proxy punya padanan i18n; 429 dari upstream tetap lewat
      // body {status:429} (HTTP proxy 200) sehingga tidak tertimpa di sini.
      if (data.code === 'uploadTooLarge') data.error = t('uploadTooLarge', { size: MB })
      else if (data.code === 'tooManyConcurrent') data.error = t('tooManyConcurrent')
      else if (data.code === 'invalidHeader') data.error = t('invalidHeader')
      else if (data.code === 'headerNotAllowed') data.error = t('headerNotAllowed')
      setResult(data)
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
          onPick={(m, p) => pick(m, p)} />
      )}
      <div className="flex flex-wrap items-end gap-2">
        <select value={method} onChange={(e) => pick(e.target.value, path)} className="input w-auto">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="pb-2 font-mono text-xs text-muted">{baseUrl}</span>
        <input value={path} onChange={(e) => setPath(e.target.value)}
          className="input min-w-40 flex-1 font-mono" />
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t('apikeyPlaceholder')}
          type="password" className="input w-56 font-mono" />
        <button onClick={send} disabled={busy || blocked || unsupported}
          className="btn-primary">
          {busy ? t('sending') : t('send')}
        </button>
      </div>

      <div className="mt-3">
        <span className="label">{t('headersTitle')}</span>
        <div className="space-y-2">
          {headerRows.map((row, i) => (
            <div key={`${row.name}-${i}`} className="flex flex-wrap items-center gap-2">
              {row.spec ? (
                <span className="w-56 truncate font-mono text-xs">
                  {row.name}
                  {row.required && <span className="text-stop" aria-hidden> *</span>}
                </span>
              ) : (
                <input value={row.name} aria-label={t('headerName')} placeholder="Authorization"
                  onChange={(e) => setHeaderRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  className="input w-56 font-mono" />
              )}
              <input value={row.value} aria-label={`${t('headerValue')}: ${row.name || t('headerName')}`}
                placeholder={t('headerValue')}
                onChange={(e) => setHeaderRows((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                className="input min-w-40 flex-1 font-mono" />
              {!row.spec && (
                <button type="button" onClick={() => setHeaderRows((prev) => prev.filter((_, j) => j !== i))}
                  className="text-sm text-stop underline">{t('headerRemove')}</button>
              )}
            </div>
          ))}
        </div>
        <button type="button"
          onClick={() => setHeaderRows((prev) => [...prev, { name: '', value: '', spec: false, required: false }])}
          className="btn-ghost mt-2 text-sm">{t('headerAdd')}</button>
      </div>

      {blocked && <p className="mt-2 text-sm text-warn">{t('notRoutableHint')}</p>}
      {unsupported && <p className="mt-2 text-sm text-warn">{t('endpointUnsupportedRef')}</p>}

      {multipart && current && (
        <div className="mt-2 space-y-3 rounded-lg border border-line bg-paper/60 p-3">
          {current.formFields.length === 0 ? (
            <p className="text-sm text-muted">{t('multipartUnsupportedBySpec')}</p>
          ) : (
            current.formFields.map((f) => {
              const picked = files[f.name] ?? []
              return (
                <div key={f.name}>
                  <span className="label">
                    {f.name}
                    {f.required && <span className="text-stop" aria-hidden> *</span>}
                  </span>
                  {f.unsupported ? (
                    <input disabled className="input font-mono" placeholder={f.unsupported} aria-label={f.name} />
                  ) : f.type === 'binary' ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="btn-ghost cursor-pointer text-sm">
                          {t('fileAdd')}
                          <input type="file" multiple className="hidden" aria-label={`${t('fileField')}: ${f.name}`}
                            onChange={(e) => {
                              const added = Array.from(e.target.files ?? [])
                              e.target.value = ''
                              if (added.length > 0) {
                                setFiles((prev) => ({ ...prev, [f.name]: [...(prev[f.name] ?? []), ...added] }))
                              }
                            }} />
                        </label>
                      </div>
                      {picked.length > 0 && (
                        <ul className="mt-1 space-y-1">
                          {picked.map((file, i) => (
                            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-xs">
                              <span className="truncate font-mono">{file.name}</span>
                              <span className="shrink-0 text-muted">{fmtBytes(file.size)}</span>
                              <button type="button" onClick={() => setFiles((prev) => ({
                                ...prev,
                                [f.name]: (prev[f.name] ?? []).filter((_, j) => j !== i),
                              }))}
                                className="shrink-0 text-stop underline">{t('fileRemove')}</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <input value={text[f.name] ?? ''} aria-label={f.name}
                      onChange={(e) => setText((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      placeholder={t('textValuePlaceholder')} className="input font-mono" />
                  )}
                </div>
              )
            })
          )}
          <p className="text-xs text-muted">{t('fileSizeLimit', { size: MB })}</p>
        </div>
      )}

      {method !== 'GET' && !multipart && !unsupported && (
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
          placeholder={t('bodyPlaceholder')} className="input mt-2 font-mono" />
      )}
      {formError && <p className="mt-2 text-sm text-stop">{formError}</p>}

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
