import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { approveUser, suspendUser, activateUser } from '@/actions/admin-users'
import PendingButton from '@/components/PendingButton'
import FilterBar, { countActive } from '@/components/FilterBar'
import NewUserForm from '@/components/NewUserForm'
import SetPasswordForm from '@/components/SetPasswordForm'

const badge: Record<string, string> = {
  pending: 'badge-warn',
  active: 'badge-go',
  suspended: 'badge-stop',
}

type Filters = { q?: string; status?: string; role?: string; type?: string }

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const conds: SQL[] = []
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim()}%`
    conds.push(or(
      sql`${users.name} ILIKE ${like}`,
      sql`${users.email} ILIKE ${like}`,
      sql`${users.organization} ILIKE ${like}`,
    )!)
  }
  if (sp.status === 'pending' || sp.status === 'active' || sp.status === 'suspended') conds.push(eq(users.status, sp.status))
  if (sp.role === 'developer' || sp.role === 'portal-admin') conds.push(eq(users.role, sp.role))
  if (sp.type === 'internal' || sp.type === 'external') conds.push(eq(users.type, sp.type))

  const rows = await db.select().from(users)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(users.createdAt))
  const active = countActive(sp, ['q', 'status', 'role', 'type'])

  return (
    <main>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Users</h1>
        <span className="text-sm text-muted">{rows.length} users{active > 0 ? ` · ${active} active filters` : ''}</span>
      </div>

      <NewUserForm />

      <FilterBar resetHref="/admin/users" activeCount={active}>
        <label className="text-sm">
          <span className="label">Search</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="name / email / organization" className="input w-64" />
        </label>
        <label className="text-sm">
          <span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ''} className="input w-auto">
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Role</span>
          <select name="role" defaultValue={sp.role ?? ''} className="input w-auto">
            <option value="">All</option>
            <option value="developer">developer</option>
            <option value="portal-admin">portal-admin</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Type</span>
          <select name="type" defaultValue={sp.type ?? ''} className="input w-auto">
            <option value="">All</option>
            <option value="internal">internal</option>
            <option value="external">external</option>
          </select>
        </label>
      </FilterBar>

      <table className="table-base">
        <thead>
          <tr>
            <th>Name</th><th>Email</th><th>Organization</th>
            <th>Type</th><th>Verified</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.organization ?? '-'}</td>
              <td>{u.type}</td>
              <td>{u.emailVerifiedAt ? '✓' : '✗'}</td>
              <td><span className={badge[u.status]}>{u.status}</span></td>
              <td className="space-x-2">
                {u.status === 'pending' && (
                  <form action={approveUser.bind(null, u.id)} className="inline">
                    <PendingButton
                      confirm={u.emailVerifiedAt ? undefined : `${u.email} has not verified their email. Approving also marks it verified (admin vouches). Continue?`}
                      className="btn-primary btn-sm"
                    >Approve</PendingButton>
                  </form>
                )}
                {u.status === 'active' && (
                  <form action={suspendUser.bind(null, u.id)} className="inline">
                    <PendingButton confirm={`Suspend ${u.email}? They lose access immediately.`} className="btn-danger btn-sm">Suspend</PendingButton>
                  </form>
                )}
                {u.status === 'suspended' && (
                  <form action={activateUser.bind(null, u.id)} className="inline">
                    <PendingButton className="btn-outline btn-sm">Activate</PendingButton>
                  </form>
                )}
                <SetPasswordForm userId={u.id} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No users match the filters.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
