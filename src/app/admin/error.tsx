'use client'

import Link from 'next/link'

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="mb-4 text-xl font-bold">Terjadi kesalahan</h1>
      <p className="mb-4 text-sm text-gray-600">
        Aksi gagal diproses. Sesi Anda mungkin berakhir atau tidak memiliki izin.
      </p>
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="rounded border px-4 py-2">Coba lagi</button>
        <Link href="/auth/login" className="rounded bg-blue-600 px-4 py-2 text-white">Login ulang</Link>
      </div>
    </main>
  )
}
