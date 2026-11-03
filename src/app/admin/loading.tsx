export default function AdminLoading() {
  return (
    <main aria-busy="true">
      <div className="h-6 w-56 animate-pulse rounded bg-ink/10" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full max-w-2xl animate-pulse rounded bg-ink/10" />
        ))}
      </div>
    </main>
  )
}
