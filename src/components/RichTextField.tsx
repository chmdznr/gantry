'use client'

import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'

// WYSIWYG field yang MENYIMPAN markdown: editor TipTap di layar, hidden input
// berisi hasil getMarkdown() supaya server action & render (react-markdown)
// tidak perlu berubah.
export default function RichTextField({ name, defaultValue, hint }: {
  name: string
  defaultValue: string
  hint?: string
}) {
  const [markdown, setMarkdown] = useState(defaultValue)
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: defaultValue,
    contentType: 'markdown',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const md = editor.getMarkdown().trim()
      // Dokumen "kosong" (satu paragraf hampa) harus tersimpan sebagai string
      // kosong agar fallback default di resolveContent tetap bekerja.
      setMarkdown(editor.state.doc.textContent.trim() === '' ? '' : md)
    },
  })

  const btn = (label: string, active: boolean, onClick: () => void, title: string) => (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={`rounded px-2 py-0.5 text-xs font-semibold ${active ? 'bg-band text-band-ink' : 'text-muted hover:bg-line/50'}`}>
      {label}
    </button>
  )

  return (
    <div>
      <input type="hidden" name={name} value={markdown} />
      <div className="input !p-0">
        {editor && (
          <div className="flex items-center gap-1 border-b border-line px-2 py-1">
            {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold')}
            {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic')}
            {btn('••', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list')}
            {btn('🔗', editor.isActive('link'), () => {
              if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return }
              const url = window.prompt('URL tautan:')
              if (url) editor.chain().focus().setLink({ href: url }).run()
            }, 'Link')}
          </div>
        )}
        <EditorContent editor={editor}
          className="[&_.tiptap]:min-h-16 [&_.tiptap]:px-3 [&_.tiptap]:py-2 [&_.tiptap]:outline-none [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2" />
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
