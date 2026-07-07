import Link from 'next/link'

// Panel filter GET-form yang seragam untuk halaman daftar admin.
// Anak-anaknya: <label><span className="label">..</span><select|input name=".." className="input"/></label>
export default function FilterBar({ resetHref, activeCount, children }: {
  resetHref: string
  activeCount: number
  children: React.ReactNode
}) {
  return (
    <form className="card mb-5 flex flex-wrap items-end gap-3">
      {children}
      <div className="flex gap-2">
        <button className="btn-primary">Terapkan</button>
        {activeCount > 0 && <Link href={resetHref} className="btn-outline">Reset</Link>}
      </div>
    </form>
  )
}

export function countActive(sp: Record<string, string | undefined>, keys: string[]): number {
  return keys.filter((k) => sp[k]?.trim()).length
}
