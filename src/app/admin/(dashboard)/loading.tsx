export default function DashboardLoading() {
  return (
    <main aria-busy="true">
      <div className="mb-6 h-6 w-40 animate-pulse rounded bg-ink/10" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="h-3 w-24 animate-pulse rounded bg-ink/10" />
            <div className="mt-4 h-8 w-16 animate-pulse rounded bg-ink/10" />
          </div>
        ))}
      </div>
      <div className="mb-3 h-4 w-32 animate-pulse rounded bg-ink/10" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card">
            <div className="h-4 w-40 animate-pulse rounded bg-ink/10" />
            <div className="mt-3 h-3 w-56 animate-pulse rounded bg-ink/10" />
          </div>
        ))}
      </div>
    </main>
  )
}
