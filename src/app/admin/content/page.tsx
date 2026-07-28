import { like } from 'drizzle-orm'
import { db } from '@/db'
import { portalSettings } from '@/db/schema'
import { CONTENT_FIELDS, CONTENT_LOCALES, contentKey, getContentDefaults } from '@/lib/site-content'
import { updateSiteContent } from '@/actions/admin-content'
import PendingButton from '@/components/PendingButton'
import RichTextField from '@/components/RichTextField'

export default async function AdminContentPage() {
  const rows = await db.select().from(portalSettings).where(like(portalSettings.key, 'content.%'))
  const stored = new Map(rows.map((r) => [r.key, r.value]))
  const def = { en: await getContentDefaults('en'), id: await getContentDefaults('id') }
  const groups = [...new Set(CONTENT_FIELDS.map((f) => f.group))]

  return (
    <main>
      <h1 className="mb-1 text-xl font-bold">Site content</h1>
      <p className="mb-6 text-sm text-muted">Leave a field empty to use the built-in default. Changes apply immediately. Hero text and Footer support rich text (bold, links, lists).</p>
      <form action={updateSiteContent} className="space-y-8">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="section-title !mt-0">{group}</h2>
            <div className="space-y-4">
              {CONTENT_FIELDS.filter((f) => f.group === group).map((f) => (
                <div key={f.base}>
                  <label className="label">{f.label}</label>
                  {f.perLocale ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CONTENT_LOCALES.map((loc) =>
                        'multiline' in f ? (
                          <RichTextField key={loc} name={contentKey(f.base, loc)}
                            defaultValue={stored.get(contentKey(f.base, loc)) ?? ''}
                            hint={`${loc.toUpperCase()} · default: ${def[loc][f.base as keyof typeof def['en']]}`} />
                        ) : (
                          <input key={loc} name={contentKey(f.base, loc)}
                            defaultValue={stored.get(contentKey(f.base, loc)) ?? ''}
                            placeholder={`${loc.toUpperCase()} · ${def[loc][f.base as keyof typeof def['en']]}`}
                            className="input" />
                        )
                      )}
                    </div>
                  ) : (
                    <input name={contentKey(f.base)} defaultValue={stored.get(contentKey(f.base)) ?? ''}
                      placeholder={def.en[f.base as keyof typeof def['en']]} className="input" />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        <PendingButton className="btn-accent">Save content</PendingButton>
      </form>
    </main>
  )
}
