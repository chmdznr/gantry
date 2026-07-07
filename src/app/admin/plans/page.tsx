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
      <table className="table-base max-w-2xl">
        <thead><tr className="border-b text-left"><th className="py-2">Nama</th><th>Limit</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-medium">{p.name}</td>
              <td>{Object.entries(p.rateLimit as Record<string, number>).map(([k, v]) => `${v}/${k}`).join(', ')}</td>
              <td className="text-muted">{p.description}</td>
              <td className="text-right">
                <form action={deletePlan.bind(null, p.id)}>
                  <PendingButton className="btn-danger btn-sm">Hapus</PendingButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
