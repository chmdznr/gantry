import { db } from '@/db'
import { plans } from '@/db/schema'
import { deletePlan } from '@/actions/admin-plans'
import PlanForm from '@/components/PlanForm'
import PendingButton from '@/components/PendingButton'

export default async function AdminPlansPage() {
  const rows = await db.select().from(plans).orderBy(plans.name)
  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Plans (Rate-Limit Tiers)</h1>
      <div className="mb-6"><PlanForm /></div>
      <table className="w-full max-w-2xl border-collapse text-sm">
        <thead><tr className="border-b text-left"><th className="py-2">Nama</th><th>Limit</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-medium">{p.name}</td>
              <td>{Object.entries(p.rateLimit as Record<string, number>).map(([k, v]) => `${v}/${k}`).join(', ')}</td>
              <td className="text-gray-600">{p.description}</td>
              <td className="text-right">
                <form action={deletePlan.bind(null, p.id)}>
                  <PendingButton className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">Hapus</PendingButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
