'use client'

import Link from 'next/link'

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page max-w-md text-center">
      <h1 className="mb-4 text-xl font-bold">Terjadi kesalahan</h1>
      <p className="mb-4 text-sm text-muted">
        Aksi gagal diproses. Sesi Anda mungkin berakhir atau tidak memiliki izin.
      </p>
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="btn-outline">Coba lagi</button>
        <Link href="/auth/login" className="btn-primary">Login ulang</Link>
      </div>
    </main>
  )
}
