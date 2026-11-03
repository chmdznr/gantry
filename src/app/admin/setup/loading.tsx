export default function SetupLoading() {
  return (
    <main className="max-w-3xl" aria-busy="true">
      <div className="h-6 w-64 animate-pulse rounded bg-ink/10" />
      <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded bg-ink/10" />
      <div className="mt-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-3 border-b py-3">
            <div className="h-4 w-4 animate-pulse rounded bg-ink/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 animate-pulse rounded bg-ink/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
