import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { approveUser, suspendUser, activateUser } from '@/actions/admin-users'
import PendingButton from '@/components/PendingButton'

const badge: Record<string, string> = {
  pending: 'badge-warn',
  active: 'badge-go',
  suspended: 'badge-stop',
}

export default async function AdminUsersPage() {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt))
  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Users</h1>
      <table className="table-base">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Nama</th><th>Email</th><th>Organisasi</th>
            <th>Tipe</th><th>Verified</th><th>Status</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.name}</td>
              <td>{u.email}</td>
              <td>{u.organization ?? '-'}</td>
              <td>{u.type}</td>
              <td>{u.emailVerifiedAt ? '✓' : '✗'}</td>
              <td><span className={`${badge[u.status]}`}>{u.status}</span></td>
              <td className="space-x-2 py-1">
                {u.status === 'pending' && u.emailVerifiedAt && (
                  <form action={approveUser.bind(null, u.id)} className="inline">
                    <PendingButton className="btn-primary btn-sm">Approve</PendingButton>
                  </form>
                )}
                {u.status === 'active' && (
                  <form action={suspendUser.bind(null, u.id)} className="inline">
                    <PendingButton className="btn-danger btn-sm">Suspend</PendingButton>
                  </form>
                )}
                {u.status === 'suspended' && (
                  <form action={activateUser.bind(null, u.id)} className="inline">
                    <PendingButton className="btn-outline btn-sm">Aktifkan</PendingButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
