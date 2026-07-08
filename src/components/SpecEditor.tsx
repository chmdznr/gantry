'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { updateProductSpec, type ActionState } from '@/actions/admin-products'

export default function SpecEditor({ productId, initialText }: { productId: string; initialText: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProductSpec, {})
  const [formatError, setFormatError] = useState('')
  const hostRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      doc: initialText,
      parent: hostRef.current,
      extensions: [
        basicSetup,
        json(),
        EditorView.theme({
          '&': { maxHeight: '70vh', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto' },
        }),
        // sinkronkan isi editor ke hidden input tanpa memicu re-render React
        EditorView.updateListener.of((u) => {
          if (u.docChanged && inputRef.current) inputRef.current.value = u.state.doc.toString()
        }),
      ],
    })
    viewRef.current = view
    return () => view.destroy()
    // initialText hanya dipakai saat mount; edit selanjutnya milik editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function formatJson() {
    const view = viewRef.current
    if (!view) return
    try {
      const pretty = JSON.stringify(JSON.parse(view.state.doc.toString()), null, 2)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: pretty } })
      setFormatError('')
    } catch (err) {
      setFormatError(`JSON tidak valid: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={productId} />
      <input ref={inputRef} type="hidden" name="specText" defaultValue={initialText} />
      <div ref={hostRef} className="overflow-hidden rounded border border-line bg-paper" />
      <label className="block max-w-2xl text-sm">
        <span className="mb-1 block text-muted">Change note (optional, recorded in version history)</span>
        <input name="changeNote" className="input" placeholder="e.g. Perjelas deskripsi /payments" />
      </label>
      {formatError && <p className="text-sm text-stop">{formatError}</p>}
      {state.error && <p className="text-sm text-stop">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-go">Spec tersimpan.</p>}
      <div className="flex gap-3">
        <button type="button" onClick={formatJson} className="btn-outline">Format JSON</button>
        <button disabled={pending} className="btn-primary">{pending ? 'Saving…' : 'Save spec'}</button>
      </div>
    </form>
  )
}
