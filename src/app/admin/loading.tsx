export default function AdminLoading() {
  return (
    <main aria-busy="true">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="h-6 w-56 animate-pulse rounded bg-ink/10" />
        <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="card mb-5 flex flex-wrap items-end gap-3">
        <div className="h-10 w-64 animate-pulse rounded bg-ink/10" />
        <div className="h-10 w-32 animate-pulse rounded bg-ink/10" />
        <div className="ml-auto h-10 w-24 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-4 w-40 animate-pulse rounded bg-ink/10" />
              <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
              <div className="ml-auto h-8 w-24 animate-pulse rounded bg-ink/10" />
            </div>
            <div className="mt-4 h-2 w-48 animate-pulse rounded-full bg-ink/10" />
          </div>
        ))}
      </div>
    </main>
  )
}
