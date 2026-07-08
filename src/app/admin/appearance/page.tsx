import { updateTheme } from '@/actions/admin-settings'
import PendingButton from '@/components/PendingButton'
import { getTheme, THEMES } from '@/lib/themes'

export default async function AdminAppearancePage() {
  const current = await getTheme()
  return (
    <main>
      <h1 className="mb-1 text-xl font-bold">Appearance</h1>
      <p className="mb-6 text-sm text-muted">
        Pick the site-wide theme. It applies immediately to every visitor.
      </p>
      <form action={updateTheme}>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <label key={t.key} className="cursor-pointer">
              <input
                type="radio"
                name="theme"
                value={t.key}
                defaultChecked={t.key === current}
                className="peer sr-only"
              />
              <span className="card block h-full border-2 transition peer-checked:border-amber peer-checked:shadow-[0_6px_20px_-8px_rgb(16_49_43_/_0.25)] peer-focus-visible:outline-2 peer-focus-visible:outline-amber">
                <span className="mb-2 flex items-center justify-between">
                  <span className="text-lg font-bold" style={{ fontFamily: `${t.fontVar}, sans-serif` }}>
                    {t.name}
                  </span>
                  {t.key === current && <span className="badge-go">Active</span>}
                </span>
                <span className="mb-3 flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span
                      key={c}
                      className="inline-block h-6 w-6 rounded-full border border-line"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="block text-sm text-muted">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
        <PendingButton className="btn-accent">Save theme</PendingButton>
      </form>
    </main>
  )
}
